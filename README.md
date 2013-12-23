taskboard
=========

A very simple kanban taskboard.

This is a working in progress but it is ready for a test drive.

Features
-
* Multiple boards
* Drag n Drop of tasks
* “Real time” refresh between multiple browsers looking to the same board
* Configurable e-mail notifications when a task is droped in a column


Installation
-
1.	Create a **MySQL** database.
1.	Execute **sql/taskboard.sql** in the created database.
1.	Copy of **taskboard.ini.template** to **taskboard.ini** and change taskboard.ini to reflect the execution environment.
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
* Sanitize
