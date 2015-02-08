package main

import (
	"github.com/quintans/taskboard/biz/impl"
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

	// DO NOT FORGET: filters are applied in reverse order (LIFO)
	fh := web.NewFilterHandler(impl.ContextFactory)

	// delivering static content and preventing malicious access
	fs := web.OnlyFilesFS{http.Dir(impl.ContentDir)}
	fileServer := http.FileServer(fs)
	fh.PushF("/*", func(ctx web.IContext) error {
		//logger.Debugf("serving static(): " + ctx.GetRequest().URL.Path)
		fileServer.ServeHTTP(ctx.GetResponse(), ctx.GetRequest())
		return nil
	})

	// this endponint is called as the expiration time of the token approaches
	fh.PushF("/refresh", impl.RefreshFilter)

	fh.PushF("/login", impl.LoginFilter, impl.TransactionFilter)

	// json services will be the most used so, they are at the front
	appCtx := impl.NewAppCtx(nil, nil)
	// service factory
	json := appCtx.BuildJsonRpc(impl.TransactionFilter)
	fh.Push("/rest/*", json)

	fh.PushF("/rest/*", impl.ResponseBuffer, impl.AuthenticationFilter)

	// limits size
	fh.PushF("/*", impl.Limit)

	http.Handle("/", fh)
	http.Handle("/feed", impl.Poll)

	logger.Infof("Listening at %s", impl.IpPort)
	logger.Debugf("Started in %f secs", time.Since(startTime).Seconds())
	if err := http.ListenAndServe(impl.IpPort, nil); err != nil {
		panic(err)
	}
}
