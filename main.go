package main

import (
	"github.com/quintans/maze"
	"github.com/quintans/taskboard/go/impl"
	"github.com/quintans/toolkit/log"

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
	app.ResponseBuffer = maze.ResponseBuffer
	app.TransactionFilter = impl.TransactionFilter
	app.LoginFilter = impl.LoginFilter
	app.PingFilter = impl.PingFilter
	app.Poll = impl.Poll
	app.IpPort = impl.IpPort

	appCtx := impl.NewAppCtx(nil, nil, nil, impl.TaskBoardService)
	// service factory
	app.JsonRpc = appCtx.BuildJsonRpcTaskBoardService(app.TransactionFilter)

	app.ContentDir = impl.ContentDir

	app.Start()
}
