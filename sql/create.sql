create database taskboard;
create user tb identified by 'tb';
GRANT ALL PRIVILEGES ON taskboard.* TO 'tb';