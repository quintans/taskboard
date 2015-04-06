package main

import (
	"github.com/quintans/taskboard/go/impl"
	"github.com/quintans/toolkit/log"
	"github.com/quintans/toolkit/web"

	"net/http"
	"runtime/debug"
	"time"
)

func main() {
	logger := log.LoggerFor("taskboad")

	startTime := time.Now()
	defer func() {
		err := recover()
		if err != nil {
			logger.Errorf("%s\n%s\n", err, debug.Stack())
		}
		// give time for the loggers to write
		time.Sleep(100 * time.Millisecond)
	}()

	// Filters will be executed in order
	fh := web.NewFilterHandler(impl.ContextFactory)

	// limits size
	fh.PushF("/*", impl.Limit)
	// security
	fh.PushF("/rest/*", impl.AuthenticationFilter, impl.ResponseBuffer)
	// json services will be the most used so, they are at the front
	appCtx := impl.NewAppCtx(nil, nil)
	// service factory
	json := appCtx.BuildJsonRpc(impl.TransactionFilter)
	fh.Push("/rest/*", json)

	fh.PushF("/login", impl.ResponseBuffer, impl.TransactionFilter, impl.LoginFilter)
	// this endponint is called as the expiration time of the token approaches
	fh.PushF("/ping", impl.ResponseBuffer, impl.AuthenticationFilter, impl.TransactionFilter, impl.PingFilter)

	// delivering static content and preventing malicious access
	fs := web.OnlyFilesFS{http.Dir(impl.ContentDir)}
	fileServer := http.FileServer(fs)
	fh.PushF("/*", func(ctx web.IContext) error {
		//logger.Debugf("serving static(): " + ctx.GetRequest().URL.Path)
		fileServer.ServeHTTP(ctx.GetResponse(), ctx.GetRequest())
		return nil
	})

	http.Handle("/", fh)
	http.Handle("/feed", impl.Poll)

	logger.Infof("Listening at %s", impl.IpPort)
	logger.Debugf("Started in %f secs", time.Since(startTime).Seconds())
	if err := http.ListenAndServe(impl.IpPort, nil); err != nil {
		panic(err)
	}
}
