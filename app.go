package main

import (
	"github.com/quintans/toolkit/log"
	"github.com/quintans/toolkit/web"

	"net/http"
	"time"
)

// App is the main application
type App struct {
	ContextFactory       func(w http.ResponseWriter, r *http.Request) web.IContext
	Limit                func(ctx web.IContext) error
	AuthenticationFilter func(ctx web.IContext) error
	ResponseBuffer       func(ctx web.IContext) error
	TransactionFilter    func(ctx web.IContext) error
	LoginFilter          func(ctx web.IContext) error
	PingFilter           func(ctx web.IContext) error
	ContentDir           func(ctx web.IContext) error
	Json                 web.Filterer
	Poll                 http.Handler
	IpPort               string
	fileServerFilter     func(ctx web.IContext) error
}

func (app *App) Start() {
	startTime := time.Now()

	logger := log.LoggerFor("taskboad")

	// Filters will be executed in order
	fh := web.NewFilterHandler(app.ContextFactory)

	// limits size
	fh.Push("/*", app.Limit)
	// security
	fh.Push("/rest/*", app.AuthenticationFilter, app.ResponseBuffer)
	// json services will be the most used so, they are at the front
	fh.Push("/rest/*", app.Json.Handle)

	fh.Push("/login", app.ResponseBuffer, app.TransactionFilter, app.LoginFilter)
	// this endponint is called as the expiration time of the token approaches
	fh.Push("/ping", app.ResponseBuffer, app.AuthenticationFilter, app.TransactionFilter, app.PingFilter)

	// delivering static content and preventing malicious access
	fh.Push("/*", app.fileServerFilter)

	http.Handle("/", fh)
	http.Handle("/feed", app.Poll)

	logger.Infof("Listening at %s", app.IpPort)
	logger.Debugf("Started in %f secs", time.Since(startTime).Seconds())
	if err := http.ListenAndServe(app.IpPort, nil); err != nil {
		panic(err)
	}
}
