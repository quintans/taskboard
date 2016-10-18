/// <reference path="typings/angularjs/angular.d.ts"/>
/// <reference path="typings/angularjs/angular-route.d.ts"/>
/// <reference path="typings/jqueryui/jqueryui.d.ts"/>
/// <reference path="infra.ts"/>
/// <reference path="controllers.ts"/>

var TASK_MOVE_BEGIN = "TB_TASK_MOVE_BEGIN";
var TASK_MOVE_END = "TB_TASK_MOVE_END";

interface IConfirmDialogScope extends ng.IScope {
    confirm: () => IConfirmDialogOptions;
    confirmCallback: () => void;
}

interface IConfirmDialogOptions {
    message?: string;
    dialog?: string;
    okButton?: string;
    cancelButton?: string;
    callback?: () => void;
};

interface JQueryExtended extends JQuery {
    resizableColumns: (...args: any[]) => void;
    confirmDialog: (options: IConfirmDialogOptions) => void;
}

interface IGridController {
    provider: () => toolkit.IProvider<any>;
}

interface IGridScope extends ng.IScope {
    provider: toolkit.IProvider<any>;
}

interface IGridAttrs {
    gridName: string;
    tip: string;
}

interface IGridOrderScope extends ng.IScope {
    direction: number;
}

interface IGridOrderAttrs {
    gridOrder: string;
}

interface IPaginatorScope extends ng.IScope {
    provider: toolkit.IProvider<any>;
    fetchPage: (page: number) => void;
    next: () => void;
    previous: () => void;
    first: () => void;
    last: () => void;
    pages: number[];
}

'use strict';

interface MyRootScope extends ng.IRootScopeService {
    requests401: Array<any>;
};


var loadingLevel = 0;
var timeoutID: number = null;
function showSpinner(show: boolean) {
    if (show) {
        if (loadingLevel == 0) {
            timeoutID = setTimeout(function() {
                $("#loading").show();
            }, 1000);
        }
        loadingLevel += 1;
    } else {
        if (loadingLevel == 1) {
            $("#loading").hide();
            clearTimeout(timeoutID);
        }
        loadingLevel -= 1;
    }
};

angular.module('taskboard', ['ngRoute', 'remoteServices', 'ngStorage', 'hc.marked', 'hljs', 'angular-markdown-editor'])
    .config(function($routeProvider: ng.route.IRouteProvider) {
        $routeProvider.
            when("/board/:boardId", {
                templateUrl: "partials/board.html",
                controller: BoardCtrl
            }).
            when("/users", {
                templateUrl: "partials/users.html",
                controller: UsersCtrl
            }).
            when("/user", {
                templateUrl: "partials/user.html",
                controller: UserCtrl
            }).
            when("/welcome", {
                templateUrl: "partials/welcome.html"
            }).
            when("/about", {
                templateUrl: "partials/about.html"
            }).
            otherwise({
                redirectTo: "/welcome"
            });
    })
    .config(function($httpProvider: ng.IHttpProvider) {
        $httpProvider.interceptors.push(function($rootScope: MyRootScope, $q, $localStorage) {
            return {
                'request': function(config) {
                    showSpinner(true);
                    config.headers = config.headers || {};
                    if ($localStorage.jwtToken) {
                        config.headers.Authorization = 'Bearer ' + $localStorage.jwtToken;
                    }
                    return config || $q.when(config);
                },
                'response': function(response) {
                    showSpinner(false);
                    return response || $q.when(response);
                },
                'responseError': function(response) {
                    showSpinner(false);
                    var status = response.status;
                    if (status === 401) {
                        var def = $q.defer();
                        var req = {
                            config: response.config,
                            deferred: def
                        };
                        $rootScope.requests401.push(req);
                        $rootScope.$broadcast(EVENT_LOGIN_REQUIRED);
                        return def.promise;
                    } else if (status === 500) {
                        toolkit.stickyError("Server Error", "Error accessing " + response.config.url + "\nView Log.");
                    }
                    return $q.reject(response);
                }
            };
        });
    })
.run(["$rootScope", "$http", "taskBoardService", "$localStorage", 
    function($rootScope: MyRootScope, $http, taskBoardService: taskboard.TaskBoardService, $localStorage) {
    // Holds all the requests which failed due to 401 response.
    $rootScope.requests401 = [];
    // On 'event:loginConfirmed', resend all the 401 requests.
    $rootScope.$on(EVENT_LOGIN_CONFIRMED, function() {
        var retry = function(req) {
            $http(req.config).then(function(response) {
                req.deferred.resolve(response);
            });
        };
        var i;
        var requests = $rootScope.requests401;
        for (i = 0; i < requests.length; i++) {
            retry(requests[i]);
        }
        $rootScope.requests401 = [];
    });
    // On 'event:loginRequest' send credentials to the server.
    $rootScope.$on(EVENT_LOGIN_REQUEST, function(event, username, password) {
        var config = {
            headers : {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}
        };
        var payload = $.param({
            username : username,
            password : password
        });
        $http.post("login", payload, config)
        .success(function(data) {
            if (data !== "") {
                $localStorage.jwtToken = data;
                $rootScope.$broadcast(EVENT_LOGIN_CONFIRMED);
            } else {
                delete $localStorage.jwtToken;
                toolkit.notice("Login", "Invalid Login");
            }
        })
        .error(function (data, status, headers, config) {
            // Erase the token if the user fails to log in
            delete $localStorage.jwtToken;
            toolkit.stickyError("Login", "Invalid Login");
          });        
    });

    function ping() {
        $http.post("ping", "")
        .success(function(data) {
            if (data !== "") {
                $localStorage.jwtToken = data;
            }
            $rootScope.$broadcast(EVENT_LOGIN_CONFIRMED);
        });
    };
    // On 'logoutRequest' invoke logout on the server and broadcast 'event:loginRequired'.
    $rootScope.$on(EVENT_LOGOUT_REQUEST, function() {
        delete $localStorage.jwtToken;
        ping();
    });
        
    ping();
    
}])    
    .directive('autoFocus', function($timeout) {
        return {
            link: function(scope: ng.IScope, element: JQuery, attrs) {
                scope.$watch(attrs.autoFocus, function(val) {
                    if (angular.isDefined(val) && val) {
                        $timeout(function() { element[0].focus(); });
                    }
                }, true);
            }
        };
    })
    .directive('onEnter', function() {
        return function(scope: ng.IScope, element: JQuery, attrs) {
            element.bind("keydown keypress", function(event: KeyboardEvent) {
                if (event.which === 13) {
                    scope.$apply(function() {
                        scope.$eval(attrs.onEnter);
                    });

                    event.preventDefault();
                }
            });
        };
    })
    .directive('onEscape', function() {
        return function(scope: ng.IScope, element: JQuery, attrs) {
            element.bind("keydown keypress", function(event: KeyboardEvent) {
                if (event.which === 27) {
                    scope.$apply(function() {
                        scope.$eval(attrs.onEscape);
                    });

                    event.preventDefault();
                }
            });
        };
    })
    .directive("tbLane", function() {
        return {
            link: function($scope: ng.IScope, element: JQuery, attrs) {
                element.addClass("lane")
                    .sortable({
                        connectWith: ".lane",
                        start: function(event, ui) {
                            ui.item.addClass("dragging");
                            ui.item.startPos = ui.item.index();
                            ui.item.startCol = ui.item.parent().index();
                            $scope.$emit(TASK_MOVE_BEGIN, null);
                        },
                        stop: function(event, ui) {
                            ui.item.removeClass("dragging");
                            var data: DragData = {
                                startLane: ui.item.startCol,
                                endLane: ui.item.parent().index(),
                                startPosition: ui.item.startPos,
                                endPosition: ui.item.index()
                            };
                            $scope.$emit(TASK_MOVE_END, data);
                        }
                    });

            }
        };
    })
    .directive("tbPortlet", function() {
        return {
            link: function($scope, element: JQuery, attrs) {
                element.addClass("portlet ui-widget ui-widget-content ui-helper-clearfix ui-corner-all")
                    .find(".portlet-header")
                    .addClass("ui-widget-header ui-corner-tr ui-corner-tl").end()
                    .find(".portlet-content").addClass("ui-corner-br ui-corner-bl");
            }
        };
    })
    .directive("tbToogle", function() {
        return {
            link: function($scope, element: JQuery, attrs) {
                element.click(function() {
                    $(this).toggleClass("glyphicon-chevron-up").toggleClass("glyphicon-chevron-down");
                    $(this).parents(".portlet:first").find(".portlet-content").slideToggle(200);
                });
            }
        };
    })
    .directive('back', ['$window', function($window) {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.bind('click', function () {
                    $window.history.back();
                });
            }
        };
    }])    
    .directive("confirm", function() {
        // end of submit
        return {
            restrict: "A",
            scope: {
                "confirm": "&",
                "confirmCallback": "&"
            },
            transclude: true,
            template: "<div ng-transclude></div>",
            link: function($scope: IConfirmDialogScope, element: JQueryExtended, attrs) {
                var options: IConfirmDialogOptions = ($scope.confirm() || {});
                options.callback = $scope.confirmCallback;
                element.confirmDialog(options);
            }
        };
    }).directive("tip", function() {
        return {
            link: function($scope, element: JQueryExtended, attrs: IGridAttrs) {
                element.tooltip({
                    placement: (attrs.tip || "top")
                });
            }
        };
    }).directive("grid", function() {
        return {
            restrict: "A",
            scope: { "provider": "=" },
            replace: true,
            transclude: true,
            template: "<table ng-transclude></table>",
            controller: function($scope: IGridScope) {
                this.provider = function(): toolkit.IProvider<any> {
                    return $scope.provider;
                };
            },
            compile: function(tElemet: JQueryExtended, attrs, transclude) {
                tElemet.resizableColumns();
                // linking function
                return function(scope: IGridScope, element: JQueryExtended, attrs: IGridAttrs) {
                    scope.provider.onFetch(function() {
                        // remove all tbody rows. May have occurred padding
                        element.find("tbody tr").remove();
                        // pad rows
                        var p = scope.provider;
                        var c = scope.provider.criteria;
                        if (p.results.length < c.pageSize) {
                            // count header columns 
                            var cols = 0;
                            element.find('tr:nth-child(1) th').each(function() {
                                if ($(this).attr('colspan')) {
                                    cols += +$(this).attr('colspan');
                                } else {
                                    cols++;
                                }
                            });
                            // build row pattern
                            var row = "";
                            for (var i = 0; i < cols; i++) {
                                row += "<td>&nbsp;</td>";
                            }
                            row = "<tr class=\"grid-pad\">" + row + "</tr>";
                        
                            // pad rows
                            var diff = c.pageSize - p.results.length;
                            for (var i = 0; i < diff; i++) {
                                $(row).appendTo(element);
                            }
                        }
                    });
                        
                    // asynchronously loads widths
                    if (attrs.gridName != null) {
                        element.resizableColumns("onStop", function(widths) {
                            scope.provider.saveConfiguration(attrs.gridName, widths.join(";"));
                        });
                        scope.provider.findConfiguration(attrs.gridName, function(result: string) {
                            if (result != null && result != "") element.resizableColumns("widths", result.split(";"));
                        });
                    }
                };
            }
        };
    }).directive("gridOrder", function() {
        return {
            restrict: "A",
            require: "^grid",
            //^ Look for the controller on parent elements as well.
            scope: { "gridOrder": "@" },
            //replace = true;
            transclude: true,
            template: "<div ng-transclude></div>",
            link: function(scope: IGridOrderScope, element: JQueryExtended, attrs: IGridOrderAttrs, gridCtrl: IGridController) {
                if (attrs.gridOrder == "") return;
                var removeSortClass = function(ele: JQueryExtended) {
                    ele.siblings().removeClass("th-sort-desc th-sort-asc");
                    ele.removeClass("th-sort-desc th-sort-asc");
                };
                var applySortClass = function(ele: JQueryExtended, dir: number) {
                    switch (dir) {
                        case -1:
                            ele.addClass("th-sort-desc");
                            break;
                        case 1:
                            ele.addClass("th-sort-asc");
                            break;
                    }
                };
                // the default that will be overriden
                element.addClass("th-sort-none");
                // and a call to server side may have been issued
                var p = gridCtrl.provider();
                if (p != null && p.criteria.orderBy == attrs.gridOrder) {
                    scope.direction = (p.criteria.ascending ? 1 : -1);
                    applySortClass(element, scope.direction);
                }
                var handler = function(ev) {
                    scope.$apply(function() {
                        var p = gridCtrl.provider();
                        var asc = -1;
                        // only collect sorting direction if it is the same order as previous
                        if (p.criteria.orderBy == attrs.gridOrder) asc = scope.direction;
                        p.criteria.orderBy = attrs.gridOrder;
                        // switch
                        var newDir = asc <= 0 ? 1 : -1;
                        p.criteria.ascending = (newDir > 0);
                        // update
                        scope.direction = newDir;
                        removeSortClass(element);
                        applySortClass(element, newDir);
                        p.refresh();
                    });
                    return true;
                };
                //element.find(".tagname").bind("click", handler);
                element.bind("click", handler);
            }
        };
    }).directive("myPaginator", function() {
        return {
            restrict: "A",
            template: "<div ng-show=\"provider.maxRecords > 0\" class=\"ui-paginator-msg\" style=\"float: left;\">Showing {{provider.pageFirst}} to {{provider.pageLast}} of {{provider.maxRecords}}</div><div ng-show=\"provider.maxPages > 1\" style=\"float: right;\"><ul class=\"ui-paginator\">" + "<li ng-class=\"{disabled: provider.currentPage==1}\"><a ng-click=\"first()\">&laquo;&laquo;</a></li>" + "<li ng-class=\"{disabled: provider.currentPage==1}\"><a ng-click=\"previous()\">&laquo;</a></li>" + "<li ng-repeat=\"pageNumber in pages\" ng-class=\"{active: provider.currentPage==pageNumber}\">" + "<a ng-click=\"fetchPage(pageNumber)\">{{pageNumber}}</a></li>" + "<li ng-class=\"{disabled: provider.currentPage==provider.maxPages}\"><a ng-click=\"next()\">&raquo;</a></li>" + "<li ng-class=\"{disabled: provider.currentPage==provider.maxPages}\"><a ng-click=\"last()\">&raquo;&raquo;</a></li>" + "</ul></div>",
            scope: { "provider": "=" },
            link: function(scope: IPaginatorScope, element: JQueryExtended, attrs) {
                var redraw = function() {
                    var len = scope.provider.maxPages;
                    var pg = scope.provider.currentPage;
                    var offset = 2;
                    var tmpLower = pg - offset;
                    var tmpUpper = pg + offset;
                    var lower = tmpLower < 1 ? 1 : tmpLower;
                    var upper = tmpUpper > len ? len : tmpUpper;
                    // upper bound
                    var off = upper - tmpUpper;
                    if (upper != tmpUpper && lower > 1) {
                        lower = lower + off < 1 ? 1 : lower + off;
                    }
                    // lower bound
                    off = lower - tmpLower;
                    if (lower != tmpLower && upper < len) {
                        upper = upper + off > len ? len : upper + off;
                    }
                    scope.pages = [];
                    for (var i = lower; i <= upper; i++) {
                        scope.pages.push(i);
                    }
                    if(scope.pages.length > 0) {
                        element.css("height", "20px");
                    }
                };
                scope.provider.onFetch(function() {
                    redraw();
                });
                scope.fetchPage = function(page) {
                    if (page != scope.provider.currentPage) {
                        scope.provider.fetchPage(page);
                    }
                };
                scope.next = function() {
                    scope.provider.fetchNextPage();
                };
                scope.previous = function() {
                    scope.provider.fetchPreviousPage();
                };
                scope.first = function() {
                    if (scope.provider.currentPage != 1) {
                        scope.provider.fetchPage(1);
                    }
                };
                scope.last = function() {
                    if (scope.provider.currentPage != scope.provider.maxPages) {
                        scope.provider.fetchPage(scope.provider.maxPages);
                    }
                };
                redraw();
            }
        };
    });

