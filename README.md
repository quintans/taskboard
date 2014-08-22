taskboard
=========

A very simple kanban taskboard.

This is a working in progress but it is ready for a test drive.

It uses AngularJS for the frontend and Go(golang) for the backend. The data is stored in a MySQL database.
The backend supplies JSON services that the frontend consumes.

Features
-
* Multiple boards
* Drag n Drop of tasks
* “Real time” refresh between multiple browsers looking to the same board
* Configurable e-mail notifications when a task is droped in a column

Dependencies
-
Go 1.2
```
go get github.com/quintans/taskboard
```

Installation
-
1.	Install a **MySQL** database.
1.	Execute **sql/create.sql** to create a database and user.
1.	Connect to the created dabase with the created user and execute **sql/taskboard.sql**.
1.	Copy **taskboard.ini.template** to **taskboard.ini** and change taskboard.ini to reflect the execution environment.
1. Compile and execute

How To
-
1.	From the Board menu choose "New Board"
1.	From the Board menu choose "New Column"
1.	Double click on the column name to edit its name
1.	Click the **+** icon of a column to add a task
1.	Double click in a task to edit
1.	Drag a task to another column or position and observe other browsers, open in the same board, upating.
1.	Click in the gear icon of the task to add e-mail notification (do not forget to configure the smtp server in the taskboard.ini file)
1.	To choose another board, choose "Open Board" from the Board menu.

Todo
-
* Tests
* Sanitize HTML
* Authentication
* Authorization
* SSL
