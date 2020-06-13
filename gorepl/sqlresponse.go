package main

// sqlResponse : response with the results to repl
type sqlResponse struct {
	MsgID        uint64        `json:"msgId"`
	EndTime      uint64        `json:"endTime"`
	StartTime    uint64        `json:"startTime"`
	Error        bool          `json:"error"`
	ErrorMessage string        `json:"errorMessage"`
	Result       []interface{} `json:"result"`
}
