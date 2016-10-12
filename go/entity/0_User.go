/**
 * WARNING: Generated code! do not change!
 * Generated by: go/Entity.ftl
 */
package entity;
import (
	"github.com/quintans/toolkit"
	"github.com/quintans/toolkit/web/app"
	"github.com/quintans/toolkit/ext"
)

var _ toolkit.Hasher = &User{}

func NewUser() *User {
	this := new(User)	
	return this
}

type User struct {
	EntityAudit
	
	//ATTRIBUTES
	Name *string `json:"name"`
	Username *string `json:"username"`
	Password *string `json:"password"`
	Dead int64 `json:"dead"`
	// ASSOCIATIONS
	// boards
	Boards []*Board `json:"boards"`
	// roles
	Roles []*Role `json:"roles"`
	// tasks
	Tasks []*Task `json:"tasks"`
}

func (this *User) SetDead(dead int64) {
	this.Dead = dead
	this.Mark("Dead")
}

func (this *User) SetUsername(username *string) {
	this.Username = username
	this.Mark("Username")
}

func (this *User) SetName(name *string) {
	this.Name = name
	this.Mark("Name")
}

func (this *User) SetPassword(password *string) {
	this.Password = password
	this.Mark("Password")
}

func (this *User) Clone() interface{} {
	clone := NewUser()
	clone.Copy(this)
	return clone
}
	
func (this *User) Copy(entity *User) {
	if entity != nil {
		this.EntityAudit.Copy(entity.EntityAudit)
		// attributes
		this.Name = app.CopyString(entity.Name)
		this.Username = app.CopyString(entity.Username)
		this.Password = app.CopyString(entity.Password)
		this.Dead = entity.Dead
		// associations
		this.Boards = make([]*Board, len(entity.Boards), cap(entity.Boards))
		copy(this.Boards, entity.Boards)
		this.Roles = make([]*Role, len(entity.Roles), cap(entity.Roles))
		copy(this.Roles, entity.Roles)
		this.Tasks = make([]*Task, len(entity.Tasks), cap(entity.Tasks))
		copy(this.Tasks, entity.Tasks)
	}
}
		
func (this *User) String() string {
	sb := toolkit.NewStrBuffer()
	sb.Add("{Id: ", this.Id, ", Version: ", this.Version)
	sb.Add(", Name: ", this.Name)
	sb.Add(", Username: ", this.Username)
	sb.Add(", Password: ", this.Password)
	sb.Add(", Dead: ", this.Dead)
	sb.Add("}")
	return sb.String()
}
	
func (this *User) Equals(e interface{}) bool {
	if this == e {
		return true
	}

	switch t := e.(type) {
	case *User:
		return this.Id != nil && t.Id != nil && *this.Id == *t.Id
	}
	return false
}

func (this *User) HashCode() int {
	result := toolkit.HashType(toolkit.HASH_SEED, this)
	result = toolkit.HashLong(result, ext.DefInt64(this.Id, 0))
	return result
}
