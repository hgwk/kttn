package config

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strconv"
	"time"
)

// portSearch is how many ports above the wanted one init tries.
const portSearch = 50

// PickPort keeps want when it is free, else takes the next free port above
// it. A port where kttn answers to screenKey counts as free: that is this
// config's own server, running while setup or init is rerun. A kttn of
// another config refuses the key and is passed over. It returns 0 when none
// is free.
func PickPort(want int, screenKey string) int {
	for port := want; port < want+portSearch && port <= 65535; port++ {
		if free(port) || (screenKey != "" && servesKttn(port, screenKey)) {
			return port
		}
	}
	return 0
}

func free(port int) bool {
	ln, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)))
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

// servesKttn recognises a running, set-up `kttn serve` that holds screenKey
// by its snapshot. One started before any config answers everyone with its
// onboarding, so it does not count.
func servesKttn(port int, screenKey string) bool {
	req, err := http.NewRequest(http.MethodGet, "http://127.0.0.1:"+strconv.Itoa(port)+"/api/snapshot", nil)
	if err != nil {
		return false
	}
	req.Header.Set("X-Kttn-Key", screenKey)
	client := http.Client{Timeout: 500 * time.Millisecond}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	var snap struct {
		Agents   []json.RawMessage `json:"agents"`
		Settings struct {
			Configured bool `json:"configured"`
		} `json:"settings"`
	}
	err = json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&snap)
	return err == nil && resp.StatusCode == http.StatusOK && snap.Agents != nil && snap.Settings.Configured
}
