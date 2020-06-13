package main

import (
	"database/sql"
	"fmt"
	"time"
)

// Sybase : Instance of Sybase Connection
type Sybase struct {
	connectionProps *connectionProperties
	connection      *sql.DB
	IsConnected     bool
}

var sybase *Sybase

// NewSybase : Creare a new instance of Sybase connection
func newSybase(props *connectionProperties) *Sybase {
	sybase = &Sybase{connectionProps: props}
	return sybase
}

// Connect : connect in Sybase db
func (s *Sybase) connect() error {
	cnxStr := fmt.Sprintf("tds://%s:%s@%s:%s/%s",
		s.connectionProps.user, s.connectionProps.password, s.connectionProps.host, s.connectionProps.port, s.connectionProps.dbName)

	db, err := sql.Open("tds", cnxStr)

	s.connection = db
	if err == nil {
		s.IsConnected = true
	}
	return err
}

func (s *Sybase) disconnect() {
	s.connection.Close()
}

func (s *Sybase) execute(message *sqlMessage, c chan sqlResponse) {

	response := sqlResponse{
		MsgID:     message.MsgID,
		StartTime: uint64(time.Now().Unix()),
	}

	result, err := s.connection.Exec(message.SQL)

	if err != nil {
		response.Error = true
		response.ErrorMessage = err.Error()
		response.EndTime = uint64(time.Now().Unix())
	} else {

		lastInsertID, _ := result.LastInsertId()
		rowsAffected, _ := result.RowsAffected()

		row := map[string]interface{}{}
		row["lastInsertID"] = lastInsertID
		row["rowsAffected"] = rowsAffected
		response.Result = append(response.Result, row)
	}
	c <- response
}

// Query : Execute a query in db
func (s *Sybase) query(message *sqlMessage, c chan sqlResponse) {

	response := sqlResponse{
		MsgID:     message.MsgID,
		StartTime: uint64(time.Now().Unix()),
	}

	rows, err := s.connection.Query(message.SQL)

	if err != nil {
		response.Error = true
		response.ErrorMessage = err.Error()
		response.EndTime = uint64(time.Now().Unix())
	} else {

		columns, errCols := rows.Columns()
		defer rows.Close()

		if errCols != nil {
			response.Error = true
			response.ErrorMessage = errCols.Error()
		}

		colNum := len(columns)

		var values = make([]interface{}, colNum)

		for i := range values {
			var ii interface{}
			values[i] = &ii
		}

		for rows.Next() {
			errScan := rows.Scan(values...)

			if errScan != nil {
				response.Error = true
				response.ErrorMessage = errScan.Error()
			}

			row := map[string]interface{}{}

			for i, column := range columns {
				row[column] = values[i]
			}
			response.Result = append(response.Result, row)
		}
		response.EndTime = uint64(time.Now().Unix())
	}
	c <- response
}
