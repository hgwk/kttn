package config

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// portSearch is how many ports above the wanted one init tries.
const portSearch = 50

// PickPort keeps want when it is free or already serves kttn, else takes the
// next free port above it. It returns 0 when none is free.
func PickPort(want int) int {
	for port := want; port < want+portSearch && port <= 65535; port++ {
		if free(port) || servesKttn(port) {
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

// servesKttn recognises a running `kttn serve` by its snapshot.
func servesKttn(port int) bool {
	client := http.Client{Timeout: 500 * time.Millisecond}
	resp, err := client.Get("http://127.0.0.1:" + strconv.Itoa(port) + "/api/snapshot")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	buf := make([]byte, 64)
	n, _ := resp.Body.Read(buf)
	return resp.StatusCode == http.StatusOK && strings.HasPrefix(string(buf[:n]), `{"agents":`)
}
