package main

import (
	"github.com/quintans/taskboard/go/impl"
	"github.com/quintans/toolkit/log"
	"github.com/quintans/toolkit/web"

	"net/http"
	"runtime"
	"runtime/debug"
	"time"
)

func main() {
	runtime.GOMAXPROCS(runtime.NumCPU())

	logger := log.LoggerFor("taskboad")

	defer func() {
		err := recover()
		if err != nil {
			logger.Errorf("%s\n%s\n", err, debug.Stack())
		}
		// give time for the loggers to write
		time.Sleep(100 * time.Millisecond)
	}()

	var app = App{}
	app.ContextFactory = impl.ContextFactory
	app.Limit = impl.Limit
	app.AuthenticationFilter = impl.AuthenticationFilter
	app.ResponseBuffer = impl.ResponseBuffer
	appCtx := impl.NewAppCtx(nil, nil, nil)
	// service factory
	app.Json = appCtx.BuildJsonRpc(impl.TransactionFilter)
	app.TransactionFilter = impl.TransactionFilter
	app.LoginFilter = impl.LoginFilter
	app.PingFilter = impl.PingFilter

	// delivering static content and preventing malicious access
	fs := web.OnlyFilesFS{http.Dir(impl.ContentDir)}
	fileServer := http.FileServer(fs)
	app.fileServerFilter = func(ctx web.IContext) error {
		//logger.Debugf("serving static(): " + ctx.GetRequest().URL.Path)
		fileServer.ServeHTTP(ctx.GetResponse(), ctx.GetRequest())
		return nil
	}

	app.Start()
}
