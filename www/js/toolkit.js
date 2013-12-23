var toolkit;
(function (toolkit) {
    function LightenDarkenColor(col, amt) {
        var usePound = false;

        if (col[0] == "#") {
            col = col.slice(1);
            usePound = true;
        }
        var num = parseInt(col, 16);
        var r = (num >> 16) + amt;

        if (r > 255)
            r = 255;
else if (r < 0)
            r = 0;

        var b = ((num >> 8) & 0x00FF) + amt;

        if (b > 255)
            b = 255;
else if (b < 0)
            b = 0;

        var g = (num & 0x0000FF) + amt;

        if (g > 255)
            g = 255;
else if (g < 0)
            g = 0;

        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);
    }
    toolkit.LightenDarkenColor = LightenDarkenColor;

    function stickyError(aTitle, message) {
        toastr.options.closeButton = true;
        toastr.options.timeOut = "5000";
        toastr.error(message, aTitle);
    }
    toolkit.stickyError = stickyError;
    ;

    function success(message) {
        toastr.options.closeButton = true;
        toastr.options.timeOut = "3000";
        toastr.success(message, "Success");
    }
    toolkit.success = success;
    ;

    function notice(aTitle, message) {
        toastr.options.closeButton = true;
        toastr.options.timeOut = "5000";
        toastr.info(message, aTitle);
    }
    toolkit.notice = notice;
    ;

    var successfulOperation = function () {
        success("Successful Operation");
    };

    function confirm(options) {
        var defaults = {
            heading: "Confirmation",
            question: "Are you sure?",
            cancelButtonTxt: "Cancel",
            okButtonTxt: "Ok"
        };

        var options = $.extend(defaults, options);

        var dialog = '<div class="modal fade">' + '  <div class="modal-dialog">' + '    <div class="modal-content">' + '      <div class="modal-header">' + '        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>' + '        <h4 class="modal-title">' + options.heading + '</h4>' + '      </div>' + '      <div class="modal-body">' + '        <p>' + options.question + '</p>' + '      </div>' + '      <div class="modal-footer">';
        if (options.callback) {
            dialog += '<button type="button" class="btn btn-default" data-dismiss="modal">' + options.cancelButtonTxt + '</button>';
        }
        dialog += '<button id="okButton" type="button" class="btn btn-primary">' + options.okButtonTxt + '</button>' + '      </div>' + '    </div>' + '  </div>' + '</div>';

        var confirmModal = $(dialog).prependTo('body');

        confirmModal.find('#okButton').click(function (event) {
            if (options.callback)
                options.callback();
            confirmModal.modal('hide');
        });

        confirmModal.on('hidden', function () {
            $(this).remove();
        });

        confirmModal.modal('show');
    }
    toolkit.confirm = confirm;
    ;

    var Fail = (function () {
        function Fail() {
        }
        return Fail;
    })();
    toolkit.Fail = Fail;

    var Criteria = (function () {
        function Criteria() {
            this.pageSize = 10;
            this.countRecords = false;
            this.ascending = true;
        }
        Criteria.prototype.clone = function () {
            var o = new Criteria();
            o.copy(this);
            return o;
        };

        Criteria.prototype.copy = function (c) {
            this.countRecords = c.countRecords;
            this.page = c.page;
            this.pageSize = c.pageSize;
            this.orderBy = c.orderBy;
            this.ascending = c.ascending;
        };
        return Criteria;
    })();
    toolkit.Criteria = Criteria;

    var Page = (function () {
        function Page() {
        }
        return Page;
    })();
    toolkit.Page = Page;

    var Provider = (function () {
        function Provider(dataSource, criteria) {
            this.maxPages = 0;
            this.currentPage = 1;
            this.maxRecords = 0;
            this.pageFirst = 0;
            this.pageLast = 0;
            this.dataSource = dataSource;
            if (criteria.page == null) {
                criteria.page = 1;
            }
            this.criteria = criteria;
            this.results = [];

            var self = this;
            this.resultHandler = function (result) {
                self.currentPage = self.criteria.page;

                self.pageFirst = (self.criteria.page - 1) * self.criteria.pageSize + 1;
                self.pageLast = self.pageFirst + result.results.length - 1;
                self.results = result.results;
                if (result.count != null) {
                    self.maxRecords = result.count;
                    self.maxPages = Math.floor(self.maxRecords / self.criteria.pageSize) + ((self.maxRecords % self.criteria.pageSize) == 0 ? 0.0 : 1.0);
                }

                // invoke callbacks
                var callbacks = self.fetchCallbacks;
                if (callbacks != null) {
                    var i;
                    for (i = 0; i < callbacks.length; i++) {
                        callbacks[i]();
                    }
                }
            };
        }
        Provider.prototype.onFetch = function (c) {
            if (this.fetchCallbacks == null)
                this.fetchCallbacks = [];

            this.fetchCallbacks.push(c);
        };

        Provider.prototype.fetchPreviousPage = function () {
            if (this.currentPage > 1) {
                this.fetchPage(this.currentPage - 1);
                return true;
            } else {
                return false;
            }
        };

        Provider.prototype.fetchNextPage = function () {
            if (this.currentPage < this.maxPages) {
                this.fetchPage(this.currentPage + 1);
                return true;
            } else {
                return false;
            }
        };

        Provider.prototype.fetchPage = function (pageNumber) {
            this.criteria.page = pageNumber;
            this.refresh();
        };

        Provider.prototype.getCriteria = function () {
            var crt = this.criteria.clone();
            crt.countRecords = (this.criteria.page == 1);
            return crt;
        };

        Provider.prototype.refresh = function () {
            this.dataSource.fetch(this.getCriteria(), this.resultHandler);
        };

        Provider.prototype.reset = function () {
            this.criteria.page = 1;
            this.maxPages = 0;
            this.currentPage = 1;
            this.maxRecords = 0;
            this.results = [];
            this.pageFirst = 0;
            this.pageLast = 0;
        };

        Provider.prototype.saveConfiguration = function (name, value) {
            // TODO: implement
        };

        Provider.prototype.findConfiguration = function (name, callback) {
            // TODO: implement
        };
        return Provider;
    })();
    toolkit.Provider = Provider;
})(toolkit || (toolkit = {}));
