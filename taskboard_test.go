package main

import (
	"database/sql"
	"fmt"
	"testing"

	"github.com/quintans/goSQL/db"
	"github.com/quintans/goSQL/test/common"
	"github.com/quintans/goSQL/translators"
	T "github.com/quintans/taskboard/biz/tables"
	"github.com/quintans/taskboard/common/dto"
)

func initDb() (db.ITransactionManager, *sql.DB) {
	translator := translators.NewMySQL5Translator()
	return common.InitDB("mysql", "tb:tb@/taskboard?parseTime=true", translator)
}

/*
func TestUserRoles(t *testing.T) {
	tm, theDB := initDb()
	store := tm.Store()
	users, err := store.Query(T.USER).
		Column(T.USER_C_ID).
		Column(T.USER_C_VERSION).
		Column(T.USER_C_NAME).
		Column(T.USER_C_USERNAME).
		Outer(T.USER_A_ROLES).On(T.ROLE_C_KIND.Matches(lov.ERole_ADMIN)).Fetch().
		Where(T.USER_C_ID.Matches(2)).
		ListFlatTreeOf((*entity.User)(nil))

	if err == nil {
		for e := users.Enumerator(); e.HasNext(); {
			user := e.Next().(*entity.User)
			fmt.Printf("User \"%v\" has %v roles\n", *user.Name, len(user.Roles))
		}
	} else {
		t.Error("There was an error: ", err)
	}

	theDB.Close()
}
*/

func TestListFunction(t *testing.T) {
	tm, theDB := initDb()
	store := tm.Store()

	_, err := store.Query(T.USER).
		Column(T.USER_C_ID).
		Column(T.USER_C_NAME).
		Column(db.Null()).
		ListInto(func(id *int64, name string, dummy string) {
		fmt.Printf("=====> Id: %v, Name: %v -- %v\n", *id, name, dummy)
	})

	if err != nil {
		t.Error("There was an error: ", err)
	}

	theDB.Close()
}

func TestListFunctionStruct(t *testing.T) {
	tm, theDB := initDb()
	store := tm.Store()

	//var users []dto.BoardUserDTO
	_, err := store.Query(T.USER).
		Column(T.USER_C_ID).
		Column(T.USER_C_NAME).
		//List(&users)
		ListInto(func(u dto.BoardUserDTO) {
		fmt.Println("X====> ", *u.Name)
	})

	if err != nil {
		t.Error("There was an error: ", err)
	}

	//for _, v := range users {
	//	fmt.Println("X====> ", *v.Name)
	//}

	theDB.Close()
}

/*
func TestInclude(t *testing.T) {
	tm, theDB := initDb()
	store := tm.Store()

	var board = new(entity.Board)
	_, err := store.Query(T.BOARD).All().
		Outer(T.BOARD_A_LANES).OrderBy(T.LANE_C_POSITION).
		Outer(T.LANE_A_TASKS).OrderBy(T.TASK_C_POSITION).
		Outer(T.TASK_A_USER).
		Include(T.USER_C_ID, T.USER_C_NAME).
		Fetch().
		Where(T.BOARD_C_ID.Matches(7)).
		SelectTree(board)

	if err != nil {
		t.Error("######### There was an error: ", err)
	} else {
		fmt.Printf("X====> %+v ", *board)
	}

	theDB.Close()
}
*/
