package main

// sqlMessage : message recived from repl
type sqlMessage struct {
	MsgID    uint64 `json:"msgId"`
	SQL      string `json:"sql"`
	SendTime uint64 `json:"sendTime"`
	Timeout  uint64 `json:"timeout"`
	IsQuery  bool   `json:"isQuery"`
}
