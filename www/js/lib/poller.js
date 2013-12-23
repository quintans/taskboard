/// <reference path="typings/jqueryui/jqueryui.d.ts"/>
var Poller = (function () {
    function Poller(poll_url, options) {
        this.poll_url = poll_url;
        this.connected = false;
        this.run = false;
        this.running = false;
        this.versions = {};
        // map declaration
        this.callbacks = {};
        var self = this;

        options = options || {};
        this.config = {
            timeout: options.timeout || 60000
        };

        this.onMessage = function (eventName, callback) {
            var list = self.callbacks[eventName];
            if (list == null) {
                self.versions[eventName] = 0;
                list = new Array();
                self.callbacks[eventName] = list;
            }
            list.push(callback);
            return self;
        };

        this.removeListener = function (eventName, callback) {
            var list = self.callbacks[eventName];
            if (list != null) {
                for (var i = 0; i < list.length; i++) {
                    if (list[i] === callback) {
                        self.callbacks[eventName] = list.splice(i, 1);
                        return self;
                    }
                }
            }
            return self;
        };

        function poll() {
            var poll_interval = 0;
            if (self.running) {
                return;
            } else {
                self.running = true;
            }

            $.ajax(self.poll_url, {
                type: 'GET',
                dataType: 'json',
                cache: false,
                data: self.versions,
                timeout: self.config.timeout
            }).done(function (messages) {
                for (var i = 0; i < messages.length; i++) {
                    var message = messages[i];
                    if (message.version != 0) {
                        self.versions[message.name] = message.version;
                        var list = self.callbacks[message.name];
                        if (list != null) {
                            for (var i = 0; i < list.length; i++) {
                                var callback = list[i];
                                callback(message.data);
                            }
                        }
                    }
                }
                if (!self.connected && self.onConnect != null) {
                    self.onConnect();
                }
                self.connected = true;
                poll_interval = 0;
            }).fail(function () {
                if (self.connected && self.onDisconnect != null) {
                    self.onConnect();
                }
                self.connected = false;
                poll_interval = 1000;
            }).always(function () {
                if (self.run) {
                    setTimeout(poll, poll_interval);
                }
                self.running = false;
            });
        }
        ;

        this.connect = function () {
            self.run = true;
            poll();
        };
        this.disconnect = function () {
            self.run = false;
        };
    }
    return Poller;
})();
