package entity

import (
	//	"github.com/quintans/goSQL/db"
	. "github.com/quintans/toolkit/ext"
	"github.com/quintans/toolkit/web/app"
)

type EntityAudit struct {
	app.EntityBase

	Creation           *Date  `json:"creation"`
	Modification       *Date  `json:"modification"`
	UserCreationId     *int64 `json:"userCreationId"`
	UserCreation       *User  `json:"userCreation"`
	UserModificationId *int64 `json:"userModificationId"`
	UserModification   *User  `json:"userModification"`
}

func (this *EntityAudit) Copy(entity EntityAudit) {
	this.EntityBase.Copy(entity.EntityBase)

	this.Id = CloneInt64(entity.Id)
	this.Creation = CloneDate(entity.Creation)
	this.Modification = CloneDate(entity.Modification)
	this.UserCreation = entity.UserCreation
	this.UserCreationId = CloneInt64(entity.UserCreationId)
	this.UserModificationId = CloneInt64(entity.UserModificationId)
	this.UserModification = entity.UserModification
}

const ATTR_USERID = "_userid_"

/*
func (this *EntityAudit) PreInsert(store db.IDb) error {
	this.Creation = NOW()
	uid, _ := store.GetAttribute(ATTR_USERID)
	if uid != nil {
		this.UserCreationId = uid.(*int64)
	}
	return nil
}

func (this *EntityAudit) PreUpdate(store db.IDb) error {
	this.Modification = NOW()
	uid, _ := store.GetAttribute(ATTR_USERID)
	if uid != nil {
		this.UserModificationId = uid.(*int64)
	}
	return nil
}
*/
