var util = require('util');
var MAGIC = 'VT01';

module.exports = function(Socket) {
  var socketExists = Socket != null;
  var proto = Socket || Connection.prototype;
  var Socket = Socket || require('net').Socket;

  if(!socketExists)
    util.inherits(Connection, Socket);

  function Connection() {
    Socket.call(this);
    this.on('readable', this._readPacket.bind(this));
  }

  proto.send = function(data) {
    // encrypt
    if (this.sessionKey) {
      data = require('steam-crypto').symmetricEncrypt(data, this.sessionKey);
    }

    var buffer = new Buffer(4 + 4 + data.length);
    buffer.writeUInt32LE(data.length, 0);
    buffer.write(MAGIC, 4);
    data.copy(buffer, 8);
    this.write(buffer);
  };

  proto._readPacket = function() {
    if (!this._packetLen) {
      var header = this.read(8);
      if (!header) {
        return;
      }
      this._packetLen = header.readUInt32LE(0);
    }
    
    var packet = this.read(this._packetLen);
    
    if (!packet) {
      this.emit('debug', 'incomplete packet');
      return;
    }
    
    delete this._packetLen;
    
    // decrypt
    if (this.sessionKey) {
      packet = require('steam-crypto').symmetricDecrypt(packet, this.sessionKey);
    }
    
    this.emit('packet', packet);
    
    // keep reading until there's nothing left
    this._readPacket();
  };

  if(socketExists) {
    Socket.on('readable', Socket._readPacket.bind(Socket));
  }

  return Connection;
};
