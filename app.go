package main

import (
	"github.com/quintans/maze"
	"github.com/quintans/toolkit/log"

	"net/http"
	"time"
)

// App is the main application
type App struct {
	ContextFactory       func(w http.ResponseWriter, r *http.Request, filters []*maze.Filter) maze.IContext
	Limit                func(ctx maze.IContext) error
	AuthenticationFilter func(ctx maze.IContext) error
	ResponseBuffer       func(ctx maze.IContext) error
	TransactionFilter    func(ctx maze.IContext) error
	LoginFilter          func(ctx maze.IContext) error
	PingFilter           func(ctx maze.IContext) error
	Poll                 http.Handler
	IpPort               string
	JsonRpc              *maze.JsonRpc
	ContentDir           string
}

func (app *App) Start() {
	startTime := time.Now()

	logger := log.LoggerFor("taskboad")

	// Filters will be executed in order
	fh := maze.NewMaze(app.ContextFactory)

	// limits size
	fh.Push("/*", app.Limit)
	// security
	fh.Push("/rest/*", app.AuthenticationFilter, app.ResponseBuffer)
	// json services will be the most used so, they are at the front
	fh.Add(app.JsonRpc.Build("/rest/taskboard")...)

	fh.Push("/login", app.ResponseBuffer, app.TransactionFilter, app.LoginFilter)
	// this endponint is called as the expiration time of the token approaches
	fh.Push("/ping", app.ResponseBuffer, app.AuthenticationFilter, app.TransactionFilter, app.PingFilter)

	// delivering static content and preventing malicious access
	fh.Static("/*", app.ContentDir)

	http.Handle("/", fh)
	http.Handle("/feed", app.Poll)

	logger.Infof("Listening at %s", app.IpPort)
	logger.Debugf("Started in %f secs", time.Since(startTime).Seconds())
	if err := http.ListenAndServe(app.IpPort, nil); err != nil {
		panic(err)
	}
}
