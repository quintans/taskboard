package impl

import (
	"github.com/quintans/goSQL/db"
	"github.com/quintans/goSQL/dbx"
	trx "github.com/quintans/goSQL/translators"
	tk "github.com/quintans/toolkit"
	"github.com/quintans/toolkit/log"
	"github.com/quintans/toolkit/web"
	"github.com/quintans/toolkit/web/poller"

	_ "github.com/go-sql-driver/mysql"
	"github.com/msbranco/goconfig"

	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"runtime"
	"runtime/debug"
	"strings"
	"time"
)

const (
	UNKNOWN = "TB00"
	DBFAIL  = "TB01"
	DBLOCK  = "TB02"
)

var (
	logger *log.Logger
	TM     db.ITransactionManager

	ContentDir     string
	IpPort         string
	postLimit      int64
	sessionTimeout time.Duration

	Poll *poller.Poller

	SmtpUser string
	SmtpPass string
	SmtpHost string
	SmtpPort string
	SmtpFrom string
)

var varguard = regexp.MustCompile("\\${[^{}]+}")

func replaceOsEnv(val string) string {
	// finds all keys in the OS environment
	values := make(map[string]string)
	keys := varguard.FindAllString(val, -1)
	for _, k := range keys {
		v := os.Getenv(k[2 : len(k)-1])
		values[k] = v
	}
	// replace the keys found
	for k, v := range values {
		val = strings.Replace(val, k, v, -1)
	}
	return val
}

func init() {
	c, err := goconfig.ReadConfigFile("taskboard.ini")
	if err != nil {
		panic(err)
	}
	// web
	ContentDir, _ = c.GetString("web", "dir")
	ContentDir = replaceOsEnv(ContentDir)
	fmt.Println("[web]dir=", ContentDir)
	IpPort, _ = c.GetString("web", "ip_port")
	IpPort = replaceOsEnv(IpPort)
	fmt.Println("[web]ip_port=", IpPort)
	timeout, _ := c.GetInt64("web", "session_timeout")
	fmt.Println("[web]session_timeout=", timeout)
	sessionTimeout = time.Duration(timeout) * time.Minute
	postLimit, _ = c.GetInt64("web", "post_limit")
	fmt.Println("[web]post_limit=", postLimit)

	//// log configuration - its the same the default
	level, _ := c.GetString("log", "level")
	level = replaceOsEnv(level)
	fmt.Println("[log]level=", level)
	file, _ := c.GetString("log", "file")
	file = replaceOsEnv(file)
	fmt.Println("[log]file=", file)
	count, _ := c.GetInt64("log", "count")
	fmt.Println("[log]count=", count)
	size, _ := c.GetInt64("log", "size")
	fmt.Println("[log]size=", size)
	logToConsole, _ := c.GetBool("log", "console")
	fmt.Println("[log]console=", logToConsole)

	logLevel := log.ParseLevel(level, log.ERROR)
	if logLevel <= log.INFO {
		log.ShowCaller(true)
	}

	// setting root writers
	writers := make([]log.LogWriter, 0)
	writers = append(writers, log.NewRollingFileAppender(file, size, int(count), true))
	if logToConsole {
		writers = append(writers, log.NewConsoleAppender(false))
	}
	log.Register("/", logLevel, writers...)

	//log.Register("/", logLevel, log.NewRollingFileAppender(file, size, int(count), true))

	//master.SetLevel("pqp", log.LogLevel(level))
	logger = log.LoggerFor("taskboad/biz/impl")

	// smtp
	SmtpHost, _ = c.GetString("smtp", "host")
	SmtpHost = replaceOsEnv(SmtpHost)
	fmt.Println("[smtp]host=", SmtpHost)
	SmtpPort, _ = c.GetString("smtp", "port")
	SmtpPort = replaceOsEnv(SmtpPort)
	fmt.Println("[smtp]port=", SmtpPort)
	SmtpUser, _ = c.GetString("smtp", "user")
	SmtpUser = replaceOsEnv(SmtpUser)
	fmt.Println("[smtp]user=", SmtpUser)
	SmtpPass, _ = c.GetString("smtp", "pass")
	SmtpPass = replaceOsEnv(SmtpPass)
	SmtpFrom, _ = c.GetString("smtp", "from")
	SmtpFrom = replaceOsEnv(SmtpFrom)
	fmt.Println("[smtp]from=", SmtpFrom)

	/*
	 * =======================
	 * BEGIN DATABASE CONFIG
	 * =======================
	 */
	// database configuration
	driverName, _ := c.GetString("database", "driver_name")
	driverName = replaceOsEnv(driverName)
	fmt.Println("[database]driver_name=", driverName)
	dataSourceName, _ := c.GetString("database", "data_source_name")
	dataSourceName = replaceOsEnv(dataSourceName)
	fmt.Println("[database]data_source_name=", dataSourceName)
	statementCache, _ := c.GetInt64("database", "statement_cache")
	fmt.Println("[database]statement_cache=", statementCache)
	idle, _ := c.GetInt64("database", "idle_connections")
	fmt.Println("[database]idle_connections=", idle)

	appDB, err := sql.Open(driverName, dataSourceName)
	if err != nil {
		panic(err)
	}

	if idle > 0 {
		appDB.SetMaxIdleConns(int(idle))
	}

	// wake up the database pool
	err = appDB.Ping()
	if err != nil {
		panic(err)
	}

	TM = db.NewTransactionManager(
		// database
		appDB,
		// databse context factory
		func(inTx *bool, c dbx.IConnection) db.IDb {
			return db.NewDb(inTx, c, trx.NewMySQL5Translator())
		},
		// statement cache
		int(statementCache),
	)
	/*
	 * =======================
	 * END DATABASE CONFIG
	 * =======================
	 */

	Poll = poller.NewPoller(30 * time.Second)
}

func TransactionFilter(ctx web.IContext) error {
	if err := TM.Transaction(func(DB db.IDb) error {
		appCtx := ctx.(*AppCtx)
		appCtx.Store = DB

		return ctx.Proceed()
	}); err != nil {
		// a business error should not produce log
		logger.Errorf("Failed Transaction: %s", err)
		return err
	}
	return nil
}

func NoTransactionFilter(ctx web.IContext) error {
	logger.Debugf("Initiating Transaction")
	if err := TM.NoTransaction(func(DB db.IDb) error {
		appCtx := ctx.(*AppCtx)
		appCtx.Store = DB

		return ctx.Proceed()
	}); err != nil {
		// a business error should not produce log
		logger.Errorf("Failed Transaction: %s", err)
		return err
	}
	return nil
}

func ContextFactory(w http.ResponseWriter, r *http.Request) web.IContext {
	return NewAppCtx(w, r)
}

// limits the body of a post
func Limit(ctx web.IContext) (err error) {
	defer func() {
		if r := recover(); r != nil {
			if e, ok := r.(runtime.Error); ok {
				logger.Errorf("%s\n%s\n", e, debug.Stack())
			}
			err = formatError(ctx.GetResponse(), r.(error))
		}
	}()

	logger.Debugf("requesting " + ctx.GetRequest().URL.Path)
	ctx.GetRequest().Body = http.MaxBytesReader(ctx.GetResponse(), ctx.GetRequest().Body, postLimit)
	err = ctx.Proceed()
	if err != nil {
		err = formatError(ctx.GetResponse(), err)
	}
	return err
}

func formatError(w http.ResponseWriter, err error) error {
	switch t := err.(type) {
	case *web.HttpFail:
		if t.Status == http.StatusInternalServerError {
			return jsonError(t.GetCode(), t.GetMessage())
		} else {
			http.Error(w, t.Message, t.Status)
			return nil
		}
	case *dbx.PersistenceFail:
		logger.Errorf("%s", err)
		return jsonError(t.GetCode(), t.GetMessage())
	case *dbx.OptimisticLockFail:
		logger.Errorf("%s", err)
		return jsonError(t.GetCode(), t.GetMessage())
	case tk.Fault:
		return jsonError(t.GetCode(), t.GetMessage())
	default:
		return jsonError(UNKNOWN, err.Error())
	}
}

func jsonError(code string, msg string) error {
	jmsg, _ := json.Marshal(msg)
	return errors.New(fmt.Sprintf(`{"code":"%s", "message":%s}`, code, jmsg))
}
