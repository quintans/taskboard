interface IToastrOptions {
    closeButton?: boolean;
    debug?: boolean;
    positionClass?: string;
    onclick?: () => void;
    showDuration?: string;
    hideDuration?: string;
    timeOut?: string;
    extendedTimeOut?: string;
    showEasing?: string;
    hideEasing?: string;
    showMethod?: string;
    hideMethod?: string;
}

interface IToastr {
    info: (message: string, title: string) => void;
    success: (message: string, title: string) => void;
    warning: (message: string, title: string) => void;
    error: (message: string, title: string) => void;
    clear: () => void;
    options: IToastrOptions;
}

declare var toastr: IToastr;

interface ConfirmOptions {
    heading?: string;
    question?: string;
    cancelButtonTxt?: string;
    okButtonTxt?: string;
    callback?: () => void;
}

interface DragData {
    startLane: number;
    endLane: number;
    startPosition: number;
    endPosition: number;
}

module toolkit {
    export function LightenDarkenColor(col: string, amt: number) {
        var usePound = false;

        if (col[0] == "#") {
            col = col.slice(1);
            usePound = true;
        }
        var num = parseInt(col, 16);
        var r = (num >> 16) + amt;

        if (r > 255) r = 255;
        else if (r < 0) r = 0;

        var b = ((num >> 8) & 0x00FF) + amt;

        if (b > 255) b = 255;
        else if (b < 0) b = 0;

        var g = (num & 0x0000FF) + amt;

        if (g > 255) g = 255;
        else if (g < 0) g = 0;

        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);
    }

    export function stickyError(aTitle: string, message: string) {
        toastr.options.closeButton = true;
        toastr.options.timeOut = "5000";
        toastr.error(message, aTitle);
    };

    export function success(message: string) {
        toastr.options.closeButton = true;
        toastr.options.timeOut = "3000";
        toastr.success(message, "Success");
    };

    export function notice(aTitle: string, message: string) {
        toastr.options.closeButton = true;
        toastr.options.timeOut = "5000";
        toastr.info(message, aTitle);
    };

    var successfulOperation = function() {
        success("Successful Operation");
    };


    export function confirm(opts: ConfirmOptions) {
        var defaults = {
            heading: "Confirmation",
            question: "Are you sure?",
            cancelButtonTxt: "Cancel",
            okButtonTxt: "Ok"
        }

        var options = $.extend(defaults, opts);

        var dialog = '<div class="modal fade">' +
            '  <div class="modal-dialog">' +
            '    <div class="modal-content">' +
            '      <div class="modal-header">' +
            '        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>' +
            '        <h4 class="modal-title">' + options.heading + '</h4>' +
            '      </div>' +
            '      <div class="modal-body">' +
            '        <p>' + options.question + '</p>' +
            '      </div>' +
            '      <div class="modal-footer">';
        if (options.callback) {
            dialog += '<button type="button" class="btn btn-default" data-dismiss="modal">' + options.cancelButtonTxt + '</button>';
        }
        dialog += '<button id="okButton" type="button" class="btn btn-primary">' + options.okButtonTxt + '</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';

        var confirmModal = $(dialog).prependTo('body');

        confirmModal.find('#okButton').click(function(event) {
            if (options.callback)
                options.callback();
            confirmModal.modal('hide');
        });

        confirmModal.on('hidden', function() {
            $(this).remove();
        });

        confirmModal.modal('show');
    };

    export class Fail {
        error: string;
        message: string;
    }

    export class Criteria {
        page: number;
        pageSize: number = 10;
        countRecords: boolean = false;

        orderBy: string;
        ascending: boolean = true;

        clone(): Criteria {
            var o = new Criteria();
            o.copy(this);
            return o;
        }

        copy(c: Criteria) {
            this.countRecords = c.countRecords;
            this.page = c.page;
            this.pageSize = c.pageSize;
            this.orderBy = c.orderBy;
            this.ascending = c.ascending;
        }
    }

    export class Page<T> {
        // max number of records returned by the datasource
        count: number;
        // if this is the last page
        last: boolean;
        results: Array<T>;
    }


    export interface IDataSource<R> {
        fetch(criteria: Criteria, successCallback: (p: Page<R>) => void);
    }


    export interface IProvider<R> {
        saveConfiguration(name: string, value: string);
        findConfiguration(name: string, callback: (result: string) => void);
        criteria: Criteria;
        refresh();
        reset();
        maxPages: number;
        currentPage: number;
        pageFirst: number;
        pageLast: number;
        maxRecords: number;
        onFetch(callback: () => void);
        fetchPage(page: number);
        fetchNextPage();
        fetchPreviousPage();
        results: Array<R>; // last retrived page results
    }

    export class Provider<R> implements IProvider<R> {
        dataSource: IDataSource<R>;
        criteria: Criteria;
        maxPages = 0;
        currentPage = 1;
        maxRecords = 0;
        results: Array<R>;
        pageFirst = 0;
        pageLast = 0;

        fetchCallbacks: Array<() => void>;

        constructor(dataSource: IDataSource<R>, criteria: Criteria) {
            this.dataSource = dataSource;
            if (criteria.page == null) {
                criteria.page = 1;
            }
            this.criteria = criteria;
            this.results = [];
        }

        onFetch(c: () => void) {
            if (this.fetchCallbacks == null)
                this.fetchCallbacks = [];

            this.fetchCallbacks.push(c);
        }

        fetchPreviousPage(): boolean {
            if (this.currentPage > 1) {
                this.fetchPage(this.currentPage - 1);
                return true;
            } else {
                return false;
            }
        }

        fetchNextPage(): boolean {
            if (this.currentPage < this.maxPages) {
                this.fetchPage(this.currentPage + 1);
                return true;
            } else {
                return false;
            }
        }

        fetchPage(pageNumber: number) {
            this.criteria.page = pageNumber;
            this.refresh();
        }

        getCriteria(): Criteria {
            var crt: Criteria = this.criteria.clone();
            crt.countRecords = (this.criteria.page == 1);
            return crt;
        }

        refresh(callback?: () => void) {
            var self = this;
            this.dataSource.fetch(this.getCriteria(), function(result: Page<R>) {
                self.currentPage = self.criteria.page;

                self.pageFirst = (self.criteria.page - 1) * self.criteria.pageSize + 1;
                self.pageLast = self.pageFirst + result.results.length - 1;
                self.results = result.results;
                if (result.count != null) {
                    self.maxRecords = result.count;
                    self.maxPages = Math.floor(self.maxRecords / self.criteria.pageSize)
                    + ((self.maxRecords % self.criteria.pageSize) == 0 ? 0.0 : 1.0);
                }

                // invoke callbacks
                var callbacks = self.fetchCallbacks;
                if (callbacks != null) {
                    var i: number;
                    for (i = 0; i < callbacks.length; i++) {
                        callbacks[i]();
                    }
                }
                if(callback) {
                    callback();
                }
            });
        }

        reset() {
            this.criteria.page = 1;
            this.maxPages = 0;
            this.currentPage = 1;
            this.maxRecords = 0;
            this.results = [];
            this.pageFirst = 0;
            this.pageLast = 0;
        }

        saveConfiguration(name: string, value: string) {
            // TODO: implement
        }

        findConfiguration(name: string, callback: (result: string) => void) {
            // TODO: implement
        }

    }
    
    // initialize form
    export function showModal(id: string, show: boolean, onClose?: (e: Event) => void) {
        var modal = $(id);
        if(show) {
            modal.modal("show").on('hidden.bs.modal', onClose);
        } else {
            modal.modal("hide");
        }
    };
    
    export function isEmpty(str: string): boolean {
        return str === undefined || str === null || str === '';
    }
}