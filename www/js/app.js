/// <reference path="typings/angularjs/angular.d.ts"/>
/// <reference path="typings/angularjs/angular-route.d.ts"/>
/// <reference path="typings/jqueryui/jqueryui.d.ts"/>
/// <reference path="infra.ts"/>
var TASK_MOVE_BEGIN = "TB_TASK_MOVE_BEGIN";
var TASK_MOVE_END = "TB_TASK_MOVE_END";

;

var loadingLevel = 0;
var timeoutID = null;
function showSpinner(show) {
    if (show) {
        if (loadingLevel == 0) {
            timeoutID = setTimeout(function () {
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
}
;

angular.module("taskboard", ["ngRoute", "remoteServices"]).config(function ($httpProvider) {
    $httpProvider.interceptors.push(function ($q) {
        return {
            'request': function (config) {
                showSpinner(true);
                return config || $q.when(config);
            },
            'response': function (response) {
                showSpinner(false);
                return response || $q.when(response);
            },
            'responseError': function (rejection) {
                showSpinner(false);
                return $q.reject(rejection);
            }
        };
    });
}).directive('autoFocus', function ($timeout) {
    return {
        link: function (scope, element, attrs) {
            scope.$watch(attrs.autoFocus, function (val) {
                if (angular.isDefined(val) && val) {
                    $timeout(function () {
                        element[0].focus();
                    });
                }
            }, true);
        }
    };
}).directive('onEnter', function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if (event.which === 13) {
                scope.$apply(function () {
                    scope.$eval(attrs.onEnter);
                });

                event.preventDefault();
            }
        });
    };
}).directive('onEscape', function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if (event.which === 27) {
                scope.$apply(function () {
                    scope.$eval(attrs.onEscape);
                });

                event.preventDefault();
            }
        });
    };
}).directive("tbLane", function () {
    return {
        link: function ($scope, element, attrs) {
            element.addClass("lane").sortable({
                connectWith: ".lane",
                start: function (event, ui) {
                    ui.item.addClass("dragging");
                    ui.item.startPos = ui.item.index();
                    ui.item.startCol = ui.item.parent().index();
                    $scope.$emit(TASK_MOVE_BEGIN, null);
                },
                stop: function (event, ui) {
                    ui.item.removeClass("dragging");
                    var data = {
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
}).directive("tbPortlet", function () {
    return {
        link: function ($scope, element, attrs) {
            element.addClass("portlet ui-widget ui-widget-content ui-helper-clearfix ui-corner-all").find(".portlet-header").addClass("ui-widget-header ui-corner-tr ui-corner-tl").end().find(".portlet-content").addClass("ui-corner-br ui-corner-bl");
        }
    };
}).directive("tbToogle", function () {
    return {
        link: function ($scope, element, attrs) {
            element.click(function () {
                $(this).toggleClass("glyphicon-chevron-up").toggleClass("glyphicon-chevron-down");
                $(this).parents(".portlet:first").find(".portlet-content").slideToggle(200);
            });
        }
    };
}).config(function ($routeProvider) {
    $routeProvider.when("/welcome", {
        templateUrl: "partials/welcome.html"
    }).when("/board/:boardId", {
        templateUrl: "partials/board.html",
        controller: BoardCtrl
    }).otherwise({
        redirectTo: "/welcome"
    });
}).directive("confirm", function () {
    // end of submit
    return {
        restrict: "A",
        scope: {
            "confirm": "&",
            "confirmCallback": "&"
        },
        transclude: true,
        template: "<div ng-transclude></div>",
        link: function ($scope, element, attrs) {
            var options = ($scope.confirm() || {});
            options.callback = $scope.confirmCallback;
            element.confirmDialog(options);
        }
    };
}).directive("tip", function () {
    return {
        link: function ($scope, element, attrs) {
            element.tooltip({
                placement: (attrs.tip || "top")
            });
        }
    };
}).directive("grid", function () {
    return {
        restrict: "A",
        scope: { "provider": "=" },
        replace: true,
        transclude: true,
        template: "<table ng-transclude></table>",
        controller: function ($scope) {
            this.provider = function () {
                return $scope.provider;
            };
        },
        compile: function (tElemet, attrs, transclude) {
            tElemet.resizableColumns();

            // linking function
            return function (scope, element, attrs) {
                if (attrs.gridName != null) {
                    element.resizableColumns("onStop", function (widths) {
                        scope.provider.saveConfiguration(attrs.gridName, widths.join(";"));
                    });
                    scope.provider.findConfiguration(attrs.gridName, function (result) {
                        if (result != null && result != "")
                            element.resizableColumns("widths", result.split(";"));
                    });
                }
            };
        }
    };
}).directive("gridOrder", function () {
    return {
        restrict: "A",
        require: "^grid",
        //^ Look for the controller on parent elements as well.
        scope: { "gridOrder": "@" },
        //replace = true;
        transclude: true,
        template: "<div ng-transclude></div>",
        link: function (scope, element, attrs, gridCtrl) {
            if (attrs.gridOrder == "")
                return;
            var removeSortClass = function (ele) {
                ele.siblings().removeClass("th-sort-desc th-sort-asc");
                ele.removeClass("th-sort-desc th-sort-asc");
            };
            var applySortClass = function (ele, dir) {
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
            var handler = function (ev) {
                scope.$apply(function () {
                    var p = gridCtrl.provider();
                    var asc = -1;

                    if (p.criteria.orderBy == attrs.gridOrder)
                        asc = scope.direction;
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
}).directive("myPaginator", function () {
    return {
        restrict: "A",
        template: "<div ng-show=\"provider.maxRecords > 0\" class=\"pagination ui-paginator-msg\" style=\"float: left;\">Showing {{provider.pageFirst}} to {{provider.pageLast}} of {{provider.maxRecords}}</div><div ng-show=\"provider.maxPages > 1\" style=\"float: right;\"><ul class=\"pagination ui-paginator\">" + "<li ng-class=\"{disabled: provider.currentPage==1}\"><a ng-click=\"first()\">&laquo;&laquo;</a></li>" + "<li ng-class=\"{disabled: provider.currentPage==1}\"><a ng-click=\"previous()\">&laquo;</a></li>" + "<li ng-repeat=\"pageNumber in pages\" ng-class=\"{active: provider.currentPage==pageNumber}\">" + "<a ng-click=\"fetchPage(pageNumber)\">{{pageNumber}}</a></li>" + "<li ng-class=\"{disabled: provider.currentPage==provider.maxPages}\"><a ng-click=\"next()\">&raquo;</a></li>" + "<li ng-class=\"{disabled: provider.currentPage==provider.maxPages}\"><a ng-click=\"last()\">&raquo;&raquo;</a></li>" + "</ul></div>",
        scope: { "provider": "=" },
        link: function (scope, element, attrs) {
            element.css("height", "20px");
            var redraw = function () {
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
            };
            scope.provider.onFetch(function () {
                redraw();
            });
            scope.fetchPage = function (page) {
                if (page != scope.provider.currentPage) {
                    scope.provider.fetchPage(page);
                }
            };
            scope.next = function () {
                scope.provider.fetchNextPage();
            };
            scope.previous = function () {
                scope.provider.fetchPreviousPage();
            };
            scope.first = function () {
                if (scope.provider.currentPage != 1) {
                    scope.provider.fetchPage(1);
                }
            };
            scope.last = function () {
                if (scope.provider.currentPage != scope.provider.maxPages) {
                    scope.provider.fetchPage(scope.provider.maxPages);
                }
            };
            redraw();
        }
    };
});
