var app = require("express")();
var http = require("http").createServer(app);
var io = require("socket.io")(http);
var url = require("url");
var events = require("events");

var eventEmitter = new events.EventEmitter();

app.get("/*", function(req, res) {
  res.sendFile("./index.html", { root: __dirname });
});

http.listen(2300, function() {
  console.log("listening on *:2300");
});

//IO-----------------------------------------------------------------------------------------------
var users = [];
var maxUsersInNameSpace = 2;
var ns = "/";
let connectedCount = 0;

//NAMESPACES -------------------------------------------------------------------------------------
io.once("connection", socket => {
  ns = url.parse(socket.handshake.url, true).query.ns;
  console.log(ns);

  io.of(ns).on("connection", socket => {
    //deal with namespace

    if (io.nsps[ns] != null) {
      let connected = io.nsps[ns].connected;
      connectedCount = Object.keys(connected).length;

      if (ns === "/") connectedCount = 0;
    } else console.log(io.nsps);

    console.log("joining namespace " + ns);
    if (
      io.nsps[ns] != null &&
      !Object.keys(io.nsps[ns].connected).includes(socket)
    )
      handleNamespaceConnection(socket, ns, connectedCount);
    else if (io.nsps[ns] == null)
      handleNamespaceConnection(socket, ns, connectedCount);

    //socket.removeListener("connection", handleNewConnection);
  });
});

function handleNamespaceConnection(socket, ns, connectedCount) {
  if (connectedCount > maxUsersInNameSpace) {
    console.log("cannot join namespace, too many peeps");
    socket.emit("tooManyInNamespace");
    socket.disconnect();
  } else {
    console.log("connected ns: " + ns);
    socket.broadcast.emit("newUser");

    socket.on("login", function(name) {
      users.push({ name, socket });
      socket.broadcast.emit(name + " just joined!");
    });

    socket.on("chatMessage", function(msg) {
      socket.broadcast.emit("chatMessage", msg);
    });

    socket.on("disconnect", function() {
      users.forEach(user => {
        if (user.socket === socket) {
          //notify people
          if (user.name != null) {
            io.emit("chatMessage", user.name + " just disconnected");
            console.log("user " + user.name + " disconnected");
          }
        }
      });
      //remove user
      socket.removeAllListeners();
      users = users.filter(user => user.socket != socket);
    });
  }
}

//call with namespace '/' for default
function NumClientsInRoom(namespace, room) {
  var clients = io.nsps[namespace].adapter.rooms[room];
  return Object.keys(clients).length;
}
