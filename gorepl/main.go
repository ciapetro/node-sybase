package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"time"

	_ "github.com/thda/tds"
)

// Repl : Read sql messages em produces the respones
type Repl struct {
	sybase *Sybase
	stderr *bufio.Writer
	stdin  *bufio.Scanner
}

func (r *Repl) readArgs() (*connectionProperties, error) {
	args := os.Args[1:]
	if len(args) < 5 {
		return nil, fmt.Errorf("Expecting the arguments: host, port, dbname, user, password")
	}

	return &connectionProperties{args[0], args[1], args[2], args[3], args[4]}, nil
}

func (r *Repl) printResponse(response sqlResponse) {
	jsonbytes, errMarshal := json.Marshal(response)

	if errMarshal != nil {
		fmt.Println(errMarshal.Error())
		response.Error = true
		response.ErrorMessage = errMarshal.Error()
	}
	fmt.Println(string(jsonbytes))
}

func (r *Repl) processMessage(message *sqlMessage) {

	c := make(chan sqlResponse, 1)

	if message.IsQuery {
		go r.sybase.query(message, c)
	} else {
		go r.sybase.execute(message, c)
	}

	timeout := time.Duration(5) * time.Minute

	if message.Timeout > 0 {
		timeout = time.Duration(int32(message.Timeout)) * time.Millisecond
	}
	select {
	case res := <-c:
		go r.printResponse(res)
		return
	case <-time.After(timeout):
		responseTimeout := sqlResponse{
			MsgID:        message.MsgID,
			StartTime:    uint64(time.Now().Unix()),
			Error:        true,
			ErrorMessage: "Timeout",
			EndTime:      uint64(time.Now().Unix()),
		}
		go r.printResponse(responseTimeout)
		return
	}
}

func (r *Repl) readLoop() {

	for r.stdin.Scan() {

		if !r.sybase.IsConnected {
			fmt.Println("Database isn't connected.")
			r.stderr.WriteString("Database isn't connected.")
			return
		}

		text := r.stdin.Text()
		if len(text) != 0 {
			go func() {
				msg := &sqlMessage{}
				err := json.Unmarshal([]byte(text), msg)
				if err != nil {
					fmt.Println(err.Error())
					r.stderr.WriteString(err.Error())
					return
				}
				go r.processMessage(msg)
			}()
		}
	}
}

func main() {
	errorWriter := bufio.NewWriter(os.Stderr)
	scanner := bufio.NewScanner(os.Stdin)

	repl := Repl{stderr: errorWriter, stdin: scanner}

	connectionProps, err := repl.readArgs()

	if err != nil {
		repl.stderr.WriteString(err.Error())
		return
	}

	repl.sybase = newSybase(connectionProps)

	err = repl.sybase.connect()

	if err != nil {
		repl.stderr.WriteString(err.Error())
		return
	}
	fmt.Println("connected")
	defer repl.sybase.disconnect()

	repl.readLoop()

}
