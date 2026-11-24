package claudehooks

import (
	"bytes"
	"encoding/json"
	"errors"
)

// object is a JSON object that remembers its key order and keeps every value
// as the raw bytes it came with, so a rewrite only changes what it means to.
type object struct {
	keys   []string
	values map[string]json.RawMessage
}

func parseObject(raw []byte) (object, error) {
	obj := object{values: map[string]json.RawMessage{}}
	dec := json.NewDecoder(bytes.NewReader(raw))
	if tok, err := dec.Token(); err != nil || tok != json.Delim('{') {
		return obj, errors.New("not an object")
	}
	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return obj, err
		}
		key, ok := tok.(string)
		if !ok {
			return obj, errors.New("bad key")
		}
		var value json.RawMessage
		if err := dec.Decode(&value); err != nil {
			return obj, err
		}
		obj.set(key, value)
	}
	if tok, err := dec.Token(); err != nil || tok != json.Delim('}') {
		return obj, errors.New("unterminated object")
	}
	return obj, nil
}

func (o *object) get(key string) (json.RawMessage, bool) {
	value, ok := o.values[key]
	return value, ok
}

func (o *object) set(key string, value json.RawMessage) {
	if o.values == nil {
		o.values = map[string]json.RawMessage{}
	}
	if _, ok := o.values[key]; !ok {
		o.keys = append(o.keys, key)
	}
	o.values[key] = value
}

func (o *object) remove(key string) {
	if _, ok := o.values[key]; !ok {
		return
	}
	delete(o.values, key)
	for i, k := range o.keys {
		if k == key {
			o.keys = append(o.keys[:i], o.keys[i+1:]...)
			break
		}
	}
}

func (o object) encode() json.RawMessage {
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, key := range o.keys {
		if i > 0 {
			buf.WriteByte(',')
		}
		name, _ := json.Marshal(key)
		buf.Write(name)
		buf.WriteByte(':')
		buf.Write(o.values[key])
	}
	buf.WriteByte('}')
	return buf.Bytes()
}
