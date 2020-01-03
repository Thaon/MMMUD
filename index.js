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
var areas = [];
var maxUsersInNameSpace = 2;
var ns = "/";
let connectedCount = 0;

//TODO: Refactor the following externally
areas.push({
  name: "road",
  description:
    "A dark, gloomy road, seems like it leads to the square to the west",
  id: "road1",
  connections: {
    e: null,
    w: "square1",
    s: null,
    n: null
  }
});
areas.push({
  name: "square",
  description:
    "Not much to say, the square has seen better days, but you can still see glimpses of the old glory in the old fountain at its center",
  id: "square1",
  connections: {
    e: "road1",
    w: null,
    s: null,
    n: null
  }
});

//console.log(areas[0].description);

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
      users.push({ name, socket, room: areas[0] });
      socket.join(areas[0].id);
      socket.room = areas[0].id;
      socket.broadcast.emit(name + " just joined!");
      socket.emit("roomDescription", areas[0].description);
    });

    socket.on("chatMessage", function(msg) {
      socket.broadcast.to(socket.room).emit("chatMessage", msg);
    });

    socket.on("switchRoom", function(connector) {
      //check that room exists and get name of player
      let name = "";
      users.forEach(user => {
        if (user.socket === socket) {
          console.log(
            JSON.stringify(user.room.connections[connector], 2, null)
          );

          if (user.name != null) {
            name = user.name;
          }

          if (user.room.connections[connector] != null) {
            let newRoom = GetRoomFromID(user.room.connections[connector]);
            console.log("entering " + newRoom.name);
            // leave the current room (stored in session)
            socket.leave(socket.room);
            // join new room, received as function parameter
            socket.join(newRoom.id);
            socket.emit("chatMessage", "you have connected to " + newRoom.name);
            user.room = newRoom;
            socket.emit("roomDescription", user.room.description);
            // sent message to OLD room
            socket.broadcast
              .to(socket.room)
              .emit("chatMessage", name + " has left this area");
            // update socket session room title
            socket.room = newRoom.id;
            socket.broadcast
              .to(socket.room)
              .emit("chatMessage", name + " has entered the area");
            //socket.emit('updaterooms', rooms, newRoom);
          } else {
            socket.emit("chatMessage", "You can't go that way");
          }
        }
      });
    });

    socket.on("look", () => {
      users.forEach(user => {
        if (user.socket === socket) {
          if (user.room != null) {
            socket.emit("roomDescription", user.room.description);
          }
        }
      });
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

function GetRoomFromID(id) {
  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];
    if (area.id === id) {
      console.log(
        "found area associated with: " + id + ", it  is: " + area.name
      );
      return area;
    }
  }
  console.log("could not find area associated with it: " + id);
  return null;
}

//call with namespace '/' for default
function NumClientsInRoom(namespace, room) {
  var clients = io.nsps[namespace].adapter.rooms[room];
  return Object.keys(clients).length;
}
