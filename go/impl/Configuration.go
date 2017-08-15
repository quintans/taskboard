package impl

import (
	"errors"
	"io"
	"path/filepath"
	"sync"

	"github.com/dgrijalva/jwt-go"
	"github.com/quintans/goSQL/db"
	"github.com/quintans/goSQL/dbx"
	trx "github.com/quintans/goSQL/translators"
	"github.com/quintans/maze"
	tk "github.com/quintans/toolkit"
	"github.com/quintans/toolkit/log"
	"github.com/quintans/toolkit/web"
	"github.com/quintans/toolkit/web/poller"

	_ "github.com/go-sql-driver/mysql"
	"github.com/msbranco/goconfig"

	"github.com/quintans/taskboard/go/entity"
	"github.com/quintans/taskboard/go/lov"
	"github.com/quintans/taskboard/go/service"
	T "github.com/quintans/taskboard/go/tables"

	"compress/gzip"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
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

	PRINCIPAL_KEY = "principal"
	JWT_TIMEOUT   = 15
)

var (
	logger *log.Logger
	TM     db.ITransactionManager

	ContentDir string
	IpPort     string
	HttpsOnly  bool
	postLimit  int64

	Poll *poller.Poller

	SmtpUser string
	SmtpPass string
	SmtpHost string
	SmtpPort string
	SmtpFrom string

	TaskBoardService service.ITaskBoardService

	ErrNoTokenInRequest = errors.New("no token present in request")
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
	TaskBoardService = new(TaskBoardServiceImpl)

	c, err := goconfig.ReadConfigFile("taskboard.ini")
	if err != nil {
		panic(err)
	}
	/*
	 * =======
	 * WEB
	 * =======
	 */
	ContentDir, _ = c.GetString("web", "dir")
	ContentDir = replaceOsEnv(ContentDir)
	fmt.Println("[web]dir=", ContentDir)
	IpPort, _ = c.GetString("web", "ip_port")
	IpPort = replaceOsEnv(IpPort)
	fmt.Println("[web]ip_port=", IpPort)
	HttpsOnly, _ = c.GetBool("web", "https_only")
	fmt.Println("[web]https_only=", HttpsOnly)
	postLimit, _ = c.GetInt64("web", "post_limit")
	fmt.Println("[web]post_limit=", postLimit)

	/*
	 * =======
	 * LOG
	 * =======
	 */
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
	var show = logLevel <= log.INFO

	// setting root writers
	writers := make([]log.LogWriter, 0)
	writers = append(writers, log.NewRollingFileAppender(file, size, int(count), true))
	if logToConsole {
		writers = append(writers, log.NewConsoleAppender(false))
	}
	log.Register("/", logLevel, writers...).ShowCaller(show)

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

	var translator = trx.NewMySQL5Translator()
	TM = db.NewTransactionManager(
		// database
		appDB,
		// databse context factory - called for each transaction
		func(inTx *bool, c dbx.IConnection) db.IDb {
			return db.NewDb(inTx, c, translator)
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

func GenerateRandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	return b, err
}

func GenerateRandomString(s int) (string, error) {
	b, err := GenerateRandomBytes(s)
	return base64.URLEncoding.EncodeToString(b), err
}

type Principal struct {
	UserId   int64
	Username string
	Roles    []lov.ERole
	Version  int64
}

func (this *Principal) HasRole(role lov.ERole) bool {
	for _, r := range this.Roles {
		if r == role {
			return true
		}
	}
	return false
}

var secret, _ = GenerateRandomBytes(64)

func KeyFunction(token *jwt.Token) (interface{}, error) {
	return secret, nil
}

func serializePrincipal(p *Principal) (string, error) {
	principal, err := json.Marshal(*p)
	if err != nil {
		return "", err
	}
	// Create JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		PRINCIPAL_KEY: string(principal),
		// Expiration time in minutes
		"exp": time.Now().Add(time.Minute * JWT_TIMEOUT).Unix(),
	})
	return token.SignedString(secret)
}

func deserializePrincipal(r *http.Request) *Principal {
	token, err := parseFromRequest(r, KeyFunction)
	if err == nil && token.Valid {
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			p := claims[PRINCIPAL_KEY].(string)
			principal := &Principal{}
			json.Unmarshal([]byte(p), principal)
			return principal
		}
	}

	return nil
}

// Try to find the token in an http.Request.
// This method will call ParseMultipartForm if there's no token in the header.
// Currently, it looks in the Authorization header as well as
// looking for an 'access_token' request parameter in req.Form.
func parseFromRequest(req *http.Request, keyFunc jwt.Keyfunc) (token *jwt.Token, err error) {

	// Look for an Authorization header
	if ah := req.Header.Get("Authorization"); ah != "" {
		// Should be a bearer token
		if len(ah) > 6 && strings.ToUpper(ah[0:6]) == "BEARER" {
			return jwt.Parse(ah[7:], keyFunc)
		}
	}

	// Look for "access_token" parameter
	req.ParseMultipartForm(10e6)
	if tokStr := req.Form.Get("access_token"); tokStr != "" {
		return jwt.Parse(tokStr, keyFunc)
	}

	return nil, ErrNoTokenInRequest
}

func TransactionFilter(ctx maze.IContext) error {
	return TM.Transaction(func(DB db.IDb) error {
		appCtx := ctx.(*AppCtx)
		appCtx.Store = DB
		p := appCtx.Principal
		if p != nil {
			appCtx.Store.SetAttribute(entity.ATTR_USERID, p.UserId)
		}

		return ctx.Proceed()
	})
}

func NoTransactionFilter(ctx maze.IContext) error {
	return TM.NoTransaction(func(DB db.IDb) error {
		appCtx := ctx.(*AppCtx)
		appCtx.Store = DB

		return ctx.Proceed()
	})
}

func PingFilter(ctx maze.IContext) error {
	ctx.GetResponse().Header().Set("Content-Type", "text/html; charset=utf-8")

	// TODO what happens if this is called right after the user submited a password change
	// and the reply was not yet delivered/processed

	app := ctx.(*AppCtx)
	p := app.Principal
	// check if version is valid - if the user changed the password the version changes
	var uid int64
	store := app.Store
	ok, err := store.Query(T.USER).Column(T.USER_C_ID).
		Where(T.USER_C_ID.Matches(p.UserId).And(T.USER_C_VERSION.Matches(p.Version))).
		SelectInto(&uid)
	if !ok {
		// version is different
		logger.Debugf("Unable to revalidate the token, because the user no longer exists or it was changed (different version)")
		http.Error(ctx.GetResponse(), "Unauthorized", http.StatusUnauthorized)
		return nil
	} else if err != nil {
		return err
	}
	tokenString, err := serializePrincipal(p)
	if err != nil {
		return err
	}
	ctx.GetResponse().Write([]byte(tokenString))

	return nil
}

func LoginFilter(ctx maze.IContext) error {
	ctx.GetResponse().Header().Set("Content-Type", "text/html; charset=utf-8")

	//logger.Debugf("serving static(): " + ctx.GetRequest().URL.Path)
	username := ctx.GetRequest().FormValue("username")
	pass := ctx.GetRequest().FormValue("password")
	var err error
	if username != "" && pass != "" {
		store := ctx.(*AppCtx).Store
		// usernames are stored in lowercase
		username = strings.ToLower(username)
		var user entity.User
		var ok bool
		if ok, err = store.Query(T.USER).
			All().
			Inner(T.USER_A_ROLES).Fetch().
			Where(
				db.And(T.USER_C_USERNAME.Matches(username),
					T.USER_C_PASSWORD.Matches(pass))).
			SelectTree(&user); ok && err == nil {
			// role array
			roles := make([]lov.ERole, len(user.Roles))
			for k, v := range user.Roles {
				roles[k] = v.Kind
			}
			tokenString, err := serializePrincipal(&Principal{
				*user.Id,
				*user.Username,
				roles,
				*user.Version,
			})
			if err != nil {
				return err
			}
			ctx.GetResponse().Write([]byte(tokenString))
		}
	}

	return err
}

func AuthenticationFilter(ctx maze.IContext) error {
	p := deserializePrincipal(ctx.GetRequest())
	if p != nil {
		// for authorizations and business logic
		ctx.(*AppCtx).Principal = p
		return ctx.Proceed()
	} else {
		logger.Debugf("Unable to proceed: invalid token!")
		http.Error(ctx.GetResponse(), "Unauthorized", http.StatusUnauthorized)
	}

	return nil
}

func ContextFactory(w http.ResponseWriter, r *http.Request, filters []*maze.Filter) maze.IContext {
	return NewAppCtx(w, r, filters, TaskBoardService)
}

// Gzip Compression
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

func isHttps(r *http.Request) bool {
	return r.URL.Scheme == "https" ||
		strings.HasPrefix(r.Proto, "HTTPS") ||
		r.Header.Get("X-Forwarded-Proto") == "https"
}

// Create a Pool that contains previously used Writers and
// can create new ones if we run out.
var zippers = sync.Pool{New: func() interface{} {
	return gzip.NewWriter(nil)
}}

var zipexts = []string{".html", ".js", ".css", ".svg", ".xml"}

// Limit limits the body of a post, compress response and format eventual errors
func Limit(ctx maze.IContext) (err error) {
	r := ctx.GetRequest()
	// https only -- redirect in openshift
	if HttpsOnly && !isHttps(r) {
		url := "https://" + r.Host + r.RequestURI
		logger.Debugf("redirecting to %s", url)
		http.Redirect(ctx.GetResponse(), r, url, http.StatusMovedPermanently)
		return
	}

	/*
		Very Important: Before compressing the response, the "Content-Type" header must be properly set!
	*/
	// encodes only text files
	var zip bool
	var ext = filepath.Ext(r.URL.Path)
	for _, v := range zipexts {
		if v == ext {
			zip = true
			break
		}
	}
	// TODO gzip encoding should occour only after a size threshold
	if zip && strings.Contains(fmt.Sprint(r.Header["Accept-Encoding"]), "gzip") {
		appCtx := ctx.(*AppCtx)
		w := appCtx.Response
		w.Header().Set("Content-Encoding", "gzip")

		// Get a Writer from the Pool
		gz := zippers.Get().(*gzip.Writer)
		// When done, put the Writer back in to the Pool
		defer zippers.Put(gz)

		// We use Reset to set the writer we want to use.
		gz.Reset(w)
		defer gz.Close()

		appCtx.Response = gzipResponseWriter{Writer: gz, ResponseWriter: w}
	}

	defer func() {
		if r := recover(); r != nil {
			if e, ok := r.(runtime.Error); ok {
				logger.Errorf("%s\n========== Begin Stack Trace ==========\n%s\n========== End Stack Trace ==========\n", e, debug.Stack())
			}
			err = formatError(ctx.GetResponse(), r.(error))
		}
	}()

	logger.Debugf("requesting %s", r.URL.Path)
	r.Body = http.MaxBytesReader(ctx.GetResponse(), r.Body, postLimit)
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
			jsonError(w, t.GetCode(), t.GetMessage())
		} else {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			http.Error(w, t.Message, t.Status)
		}
	case *dbx.PersistenceFail:
		logger.Errorf("%s", err)
		jsonError(w, t.GetCode(), t.GetMessage())
	case *dbx.OptimisticLockFail:
		logger.Errorf("%s", err)
		jsonError(w, t.GetCode(), t.GetMessage())
	case tk.Fault:
		jsonError(w, t.GetCode(), t.GetMessage())
	default:
		jsonError(w, UNKNOWN, err.Error())
	}
	return nil
}

func jsonError(w http.ResponseWriter, code string, msg string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	jmsg, _ := json.Marshal(msg)
	http.Error(w, fmt.Sprintf(`{"code":"%s", "message":%s}`, code, jmsg), http.StatusInternalServerError)
}
