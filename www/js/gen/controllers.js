/// <reference path="typings/angularjs/angular.d.ts"/>
/// <reference path="typings/jqueryui/jqueryui.d.ts"/>
/// <reference path="typings/bootstrap/bootstrap.d.ts"/>
/// <reference path="infra.ts"/>
/// <reference path="app.ts"/>
var BOARD_CHANGE = "TB_BOARD_CHANGE";
var BOARD_LOAD = "TB_BOARD_LOAD";
var BOARD_NEWCOLUMN = "TB_BOARD_NEWCOLUMN";
var BOARD_DELCOLUMN = "TB_BOARD_DELCOLUMN";
var PAGESIZE_SMALL = 7;
var PAGESIZE_MEDIUM = 10;

function AppCtrl($scope, $location, taskBoardService) {
    function showBoardPanel() {
        $("#boardPanel").modal("show").on('hidden.bs.modal', function (e) {
            $scope.eboard = null;
        });
    }
    ;

    // keeps a record of the change of the current board
    $scope.$on(BOARD_LOAD, function (event, b) {
        $scope.board = b;
    });

    $scope.newBoard = function () {
        $scope.eboard = new taskboard.Board();
        showBoardPanel();
    };

    $scope.editBoard = function () {
        if ($scope.board != null) {
            $scope.eboard = new taskboard.Board().copy($scope.board);
            showBoardPanel();
        }
    };

    $scope.saveBoard = function () {
        var bid = $scope.eboard.id;
        taskBoardService.saveBoard($scope.eboard, function (result) {
            if (bid == null) {
                $location.path("/board/" + result.id);
            } else {
                $scope.$emit(BOARD_CHANGE, result);
            }
        });
    };

    $scope.deleteBoard = function (board) {
        taskBoardService.deleteBoard(board.id, function () {
            $scope.gridProvider.refresh();

            // if the current board is the same as the one being deleted
            if ($scope.board.id === board.id) {
                $location.path("/welcome");
            }
        });
    };

    var criteria = new taskboard.BoardSearchDTO();
    criteria.pageSize = PAGESIZE_SMALL;

    // initiate sorting
    criteria.ascending = true;
    criteria.orderBy = "name";

    var ds = {
        fetch: function (criteria, successCallback) {
            taskBoardService.fetchBoards(criteria, successCallback);
        }
    };
    $scope.gridProvider = new toolkit.Provider(ds, criteria);

    function showListBoardPanel(show) {
        var e = $("#listBoardPanel");

        if (show) {
            e.modal("show").on('hidden.bs.modal', function (e) {
                $scope.gridProvider.reset();
            });
        } else {
            e.modal("hide");
        }
    }
    ;

    $scope.openBoard = function () {
        $scope.gridProvider.refresh();
        showListBoardPanel(true);
    };

    $scope.closeList = function () {
        showListBoardPanel(false);
    };

    $scope.newColumn = function () {
        $scope.$broadcast(BOARD_NEWCOLUMN);
    };

    $scope.deleteColumn = function () {
        $scope.$broadcast(BOARD_DELCOLUMN);
    };
}

function BoardCtrl($scope, $routeParams, taskBoardService) {
    $scope.colorOptions = [
        '#FFFFFF',
        '#DBDBDB',
        '#FFB5B5',
        '#FF9E9E',
        '#FCC7FC',
        '#FC9AFB',
        '#CCD0FC',
        '#989FFA',
        '#CFFAFC',
        '#9EFAFF',
        '#94D6FF',
        '#C1F7C2',
        '#A2FCA3',
        '#FAFCD2',
        '#FAFFA1',
        '#FCE4D4',
        '#FCC19D'
    ];

    $scope.lastColor = $scope.colorOptions[14];

    $scope.editingColumn = false;

    var expandedTasks = new Array();

    if ($routeParams.boardId != null) {
        var ignoreEvents = false;
        var cacheBoard;

        var bId = $routeParams.boardId;
        var reloadCallback = function (result) {
            $scope.board = result;

            // launches a event to inform the app controller of the current board instance
            $scope.$emit(BOARD_LOAD, result);

            // rebuild expanded tasks
            var expanded = new Array();
            if (result.lanes != null) {
                for (var l = 0; l < result.lanes.length; l++) {
                    var lane = result.lanes[l];
                    if (lane.tasks != null) {
                        for (var t = 0; t < lane.tasks.length; t++) {
                            var task = lane.tasks[t];

                            for (var x = 0; x < expandedTasks.length; x++) {
                                if (expandedTasks[x] === task.id) {
                                    expanded.push(expandedTasks[x]);
                                }
                            }
                        }
                    }
                }
            }
            expandedTasks = expanded;
        };
        taskBoardService.fullyLoadBoardById(bId, reloadCallback);

        var listener = function (board) {
            //toolkit.notice("DEBUG", "board " + bId + " changed");
            if (ignoreEvents) {
                cacheBoard = board;
            } else {
                cacheBoard = null;
                $scope.$apply(function () {
                    reloadCallback(board);
                });
            }
        };

        var p = new Poller("/feed");
        p.onMessage("board:" + bId, listener).connect();

        $scope.$on("$destroy", function (event) {
            //p.removeListener("board_" + bId, listener);
            p.disconnect();
        });

        $scope.$on(TASK_MOVE_BEGIN, function (event) {
            ignoreEvents = true;
        });

        $scope.$on(TASK_MOVE_END, function (event, data) {
            ignoreEvents = false;
            if (data.startLane !== data.endLane || data.startPosition !== data.endPosition) {
                //toolkit.stickyError("DEBUG", data.startLane + "." + (data.startPosition+1) + " -> " + data.endLane + "." + (data.endPosition+1));
                var taskId = $scope.board.lanes[data.startLane].tasks[data.startPosition].id;
                var laneId = $scope.board.lanes[data.endLane].id;

                taskBoardService.moveTask({
                    taskId: taskId,
                    laneId: laneId,
                    position: data.endPosition + 1
                });
            } else if (cacheBoard != null) {
                $scope.$apply(function () {
                    reloadCallback(cacheBoard);
                });
                cacheBoard = null;
            }
        });
    }

    $scope.toogle = function (taskId) {
        var i = expandedTasks.indexOf(taskId);
        if (i != -1) {
            expandedTasks.splice(i, 1);
        } else {
            expandedTasks.push(taskId);
        }
    };

    // method to avoid colapsing an expanded task when the board refreshs
    $scope.isExpanded = function (taskId) {
        return expandedTasks.indexOf(taskId) != -1;
    };

    $scope.$on(BOARD_CHANGE, function (event, b) {
        $scope.board.name = b.name;
        $scope.board.description = b.description;
    });

    $scope.$on(BOARD_NEWCOLUMN, function (event) {
        taskBoardService.addLane($scope.board.id);
    });

    $scope.$on(BOARD_DELCOLUMN, function (event) {
        taskBoardService.deleteLastLane($scope.board.id);
    });

    $scope.saveLane = function (cname, lane) {
        if (cname != lane.name) {
            lane.name = cname;
            taskBoardService.saveLane(lane, function (result) {
                lane.version = result.version;
            });
        }
    };

    // initialize form
    function showTaskPanel() {
        $("#taskPanel").modal("show").on('hidden.bs.modal', function (e) {
            $scope.etask = null;
        });
    }
    ;

    $scope.selectTaskColor = function (color) {
        $scope.etask.headColor = color;
        $scope.etask.bodyColor = toolkit.LightenDarkenColor(color, 25);
        $scope.lastColor = color;
    };

    $scope.newTask = function (lane) {
        $scope.etask = new taskboard.Task();
        $scope.etask.laneId = lane.id;
        $scope.etask.lane = lane;
        $scope.etask.headColor = $scope.lastColor;
        $scope.etask.bodyColor = toolkit.LightenDarkenColor($scope.lastColor, 25);
        showTaskPanel();
    };

    $scope.saveTask = function () {
        taskBoardService.saveTask($scope.etask, null, function (cause) {
            toolkit.stickyError("BAD", cause.message);
        });
    };

    $scope.editTask = function (task) {
        $scope.etask = new taskboard.Task().copy(task);
        showTaskPanel();
    };

    $scope.removeTask = function (task) {
        toolkit.confirm({
            question: "This task will be remove.<br>Do you wish to continue?",
            callback: function () {
                taskBoardService.moveTask({
                    taskId: task.id,
                    laneId: task.laneId,
                    position: -1
                });
            }
        });
    };

    $scope.addNotification = function (lane, email) {
        var notif = new taskboard.Notification();
        notif.email = email;
        notif.laneId = lane.id;
        notif.taskId = $scope.etask.id;

        taskBoardService.saveNotification(notif, function (result) {
            $scope.notifProvider.refresh();
        });
    };

    $scope.saveNotification = function (notif) {
        taskBoardService.saveNotification(notif, function (result) {
            $scope.notifProvider.refresh();
        });
    };

    $scope.deleteNotification = function (notif) {
        taskBoardService.deleteNotification(notif.id, function () {
            $scope.notifProvider.refresh();
        });
    };

    var criteria = new taskboard.NotificationSearchDTO();
    criteria.pageSize = PAGESIZE_SMALL;

    // initiate sorting
    criteria.ascending = true;
    criteria.orderBy = "email";

    var ds = {
        fetch: function (criteria, successCallback) {
            taskBoardService.fetchNotifications(criteria, successCallback);
        }
    };
    $scope.notifProvider = new toolkit.Provider(ds, criteria);

    function showNotificationsPanel() {
        $("#notifPanel").modal("show").on('hidden.bs.modal', function (e) {
            $scope.notifProvider.reset();
        });
    }
    ;

    $scope.editNotifications = function (task) {
        $scope.etask = task;
        criteria.taskId = task.id;
        $scope.notifProvider.refresh();
        showNotificationsPanel();
    };

    $scope.getRealLane = function (lane) {
        var lanes = $scope.board.lanes;
        for (var i = 0; i < lanes.length; i++) {
            if (lanes[i].id === lane.id) {
                return lanes[i];
            }
        }
    };
}
