/**
 * Warning: Generated code! do not change!
 * Generated by: go/AppCtx.ftl
 */
package impl

import (
	"github.com/quintans/toolkit/web"
	"github.com/quintans/taskboard/biz/entity"
	"github.com/quintans/taskboard/common/service"
	"net/http"
	"github.com/quintans/goSQL/db"
)

func NewAppCtx(w http.ResponseWriter, r *http.Request) *AppCtx {
	this := new(AppCtx)
	this.Context = new(web.Context)
	this.Init(this, w, r)
	this.BoardDAOFactory = NewBoardDAO
	this.LaneDAOFactory = NewLaneDAO
	this.TaskDAOFactory = NewTaskDAO
	this.UserDAOFactory = NewUserDAO
	this.NotificationDAOFactory = NewNotificationDAO
	this.RoleDAOFactory = NewRoleDAO
	this.TaskBoardServiceFactory = NewTaskBoardService
	return this
}

type AppCtx struct {
	*web.Context
	
	Store db.IDb
	boardDAO entity.IBoardDAO
	BoardDAOFactory func(appCtx *AppCtx) entity.IBoardDAO
	laneDAO entity.ILaneDAO
	LaneDAOFactory func(appCtx *AppCtx) entity.ILaneDAO
	taskDAO entity.ITaskDAO
	TaskDAOFactory func(appCtx *AppCtx) entity.ITaskDAO
	userDAO entity.IUserDAO
	UserDAOFactory func(appCtx *AppCtx) entity.IUserDAO
	notificationDAO entity.INotificationDAO
	NotificationDAOFactory func(appCtx *AppCtx) entity.INotificationDAO
	roleDAO entity.IRoleDAO
	RoleDAOFactory func(appCtx *AppCtx) entity.IRoleDAO
	taskBoardService service.ITaskBoardService
	TaskBoardServiceFactory func(appCtx *AppCtx) service.ITaskBoardService
}

func (this *AppCtx) GetBoardDAO() entity.IBoardDAO {
	if this.boardDAO == nil {
		this.boardDAO = this.BoardDAOFactory(this)
	}
	return this.boardDAO
}

func (this *AppCtx) GetLaneDAO() entity.ILaneDAO {
	if this.laneDAO == nil {
		this.laneDAO = this.LaneDAOFactory(this)
	}
	return this.laneDAO
}

func (this *AppCtx) GetTaskDAO() entity.ITaskDAO {
	if this.taskDAO == nil {
		this.taskDAO = this.TaskDAOFactory(this)
	}
	return this.taskDAO
}

func (this *AppCtx) GetUserDAO() entity.IUserDAO {
	if this.userDAO == nil {
		this.userDAO = this.UserDAOFactory(this)
	}
	return this.userDAO
}

func (this *AppCtx) GetNotificationDAO() entity.INotificationDAO {
	if this.notificationDAO == nil {
		this.notificationDAO = this.NotificationDAOFactory(this)
	}
	return this.notificationDAO
}

func (this *AppCtx) GetRoleDAO() entity.IRoleDAO {
	if this.roleDAO == nil {
		this.roleDAO = this.RoleDAOFactory(this)
	}
	return this.roleDAO
}

func (this *AppCtx) GetTaskBoardService() service.ITaskBoardService {
	if this.taskBoardService == nil {
		// will GC collect this circular reference?? 
		this.taskBoardService = this.TaskBoardServiceFactory(this)
	}
	return this.taskBoardService
}

func (this *AppCtx) BuildJsonRpc(transaction func(ctx web.IContext) error) *web.JsonRpc {
	// JSON-RPC services
	var svc *web.Service
	var act *web.Action
	json := web.NewJsonRpc(nil) // json-rpc resgistry

	// JSON Vulnerability Protection.
	// AngularJS will automatically strip the prefix before processing it as JSON.
	jsonpProtection := func(ctx web.IContext) error {
		err := ctx.Proceed()
		// this must be written after because cookies might be set (ex: Login)
		if err == nil {
			ctx.GetResponse().Write([]byte(")]}',\n"))
		}
		return err
	}
	
	svc = json.RegisterAs("taskboard", this.GetTaskBoardService())
	act = svc.GetAction("Ping")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("WhoAmI")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("FetchBoards")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("FetchBoardById")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("FullyLoadBoardById")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("SaveBoard")
	act.PushFilterFunc(jsonpProtection, authorize("ADMIN"), transaction)
	act = svc.GetAction("DeleteBoard")
	act.PushFilterFunc(jsonpProtection, authorize("ADMIN"), transaction)
	act = svc.GetAction("AddLane")
	act.PushFilterFunc(jsonpProtection, authorize("ADMIN"), transaction)
	act = svc.GetAction("SaveLane")
	act.PushFilterFunc(jsonpProtection, authorize("ADMIN"), transaction)
	act = svc.GetAction("DeleteLastLane")
	act.PushFilterFunc(jsonpProtection, authorize("ADMIN"), transaction)
	act = svc.GetAction("AddUserToBoard")
	act.PushFilterFunc(jsonpProtection, authorize("ADMIN"), transaction)
	act = svc.GetAction("RemoveUserFromBoard")
	act.PushFilterFunc(jsonpProtection, authorize("ADMIN"), transaction)
	act = svc.GetAction("SaveUserName")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("ChangeUserPassword")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("SaveTask")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("MoveTask")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("FetchNotifications")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("SaveNotification")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	act = svc.GetAction("DeleteNotification")
	act.PushFilterFunc(jsonpProtection, authorize("USER"), transaction)
	return json
}

func authorize(roles ...string) func(ctx web.IContext) error {
	return func(ctx web.IContext) error {
		user := ctx.GetPrincipal().(Principal)
		for _, r := range roles {
			for _, role := range user.Roles {
				if r == string(role) {
					if err := ctx.Proceed(); err != nil {
						return err
					}
					return nil
				}
			}
		}
		http.Error(ctx.GetResponse(), "Unauthorized", http.StatusUnauthorized)
		return nil
	}
}
