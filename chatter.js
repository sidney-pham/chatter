const BOT_ID = "BOT";
const BOT_NAME = "Chatter";

Chats = new Mongo.Collection("Chats");

Router.configure({
    layoutTemplate: "main"
});

Router.route("/", {
    template: "home"
});

if (Meteor.isClient) {
    // Probably should move this line somewhere else so that when the user
    // refreshes the page, who they're talking to is remembered.
    Session.set("chattingWith", "none");

    Template.notLoggedIn.helpers({
        "socialLoginConfigured": function() {
            return Accounts.loginServicesConfigured();
        }
    });

    Template.facebookLogin.events({
        "click .fbLogin": function(event) {
            Meteor.loginWithFacebook({}, function(error) {
                if (error) {
                    console.log("Error logging in!");
                    console.log(error);
                }
            });
        }
    });

    Template.app.helpers({
        "user": function() {
            var currentUser = Meteor.userId();
            return Meteor.users.findOne({_id: currentUser});
        }
    });

    Template.app.events({
        "click .logout": function(event) {
            event.preventDefault();
            Meteor.logout();
            Session.set("chattingWith", "none");
        }
    });

    Template.addFriends.helpers({
        "friendsToAdd": function() {
            var friendsToAdd = [];

            var allUsers = Meteor.users.find().fetch();
            var currentUser = Meteor.userId();
            var friendsList = Meteor.users.findOne({_id: currentUser}).profile.friends;

            allUsers.forEach(function(user) {
                var otherPlayerId = user._id;
                var isFriend = friendsList.indexOf(otherPlayerId) != -1;

                if (!isFriend && otherPlayerId != currentUser) {
                    friendsToAdd.push(user);
                }
            });

            return friendsToAdd;
        }
    });

    // When you add a friend, you have to update your new friend's
    // friend list so that you are their friend as well. This requires
    // more privileges, so you need to run this from a method.
    Template.addFriends.events({
        "change .addFriendCheckbox": function() {
            var currentUser = Meteor.userId();
            var newFriendId = this._id;

            Meteor.call("addFriend", currentUser, newFriendId);
        }
    });

    Template.chatWindow.helpers({
        // We can't just return friendsList since friendsList contains
        // the IDs of each friend and not the entire user object.
        "friends": function() {
            var friends = []
            var allUsers = Meteor.users.find().fetch();
            var currentUser = Meteor.userId();
            var friendsList = Meteor.users.findOne({_id: currentUser}).profile.friends;

            allUsers.forEach(function(user) {
                var otherPlayerId = user._id;
                var isFriend = friendsList.indexOf(otherPlayerId) != -1;

                if (isFriend) {
                    friends.push(user);
                }
            });

            return friends;
        }, "otherUsersExist": function() {
            var allUsers = Meteor.users.find().fetch();
            var otherUsers = allUsers.length > 1;

            return otherUsers;
        }, "friendSelected": function() {
            var chattingWith = Session.get("chattingWith");

            return chattingWith != "none";
        }, "selected": function() {
            var friendId = this._id;
            var chattingWith = Session.get("chattingWith");

            if (friendId == Session.get("chattingWith")) {
                return "selected";
            }
        }, "chattingWith": function() {
            var chattingWith = Session.get("chattingWith");

            if (chattingWith == "none") {
                return "Select a friend to chat to!";
            } else {
                var playerChattingWith;
                var allUsers = Meteor.users.find().fetch();
                var currentUser = Meteor.userId();

                allUsers.forEach(function(user) {
                    var otherPlayerId = user._id;

                    if (otherPlayerId == chattingWith) {
                        playerChattingWith = user;
                    }
                });

                return playerChattingWith;
            }
        }, "messages": function() {
            var currentUser = Meteor.userId();
            var chattingWith = Session.get("chattingWith");
            var users = [currentUser, chattingWith].sort();

            var chatExists = Chats.findOne({users: users});

            if (chatExists) {
                var messages = Chats.findOne({users: users}).messages;

                return messages;
            } else {
                var chattingWithName = Meteor.users.findOne(chattingWith).profile.firstName;
                var greeting = "Say hello to " + chattingWithName + "!";
                var message = {
                    text: greeting,
                    from: BOT_ID,
                    sentAt: new Date()
                };

                return [message];
            }
        }, "fromWhom": function(from) {
            var currentUser = Meteor.userId();

            if (from == currentUser) {
                return "You";
            } else {
                var friendsName;

                // If the message is from bot!
                if (from == BOT_ID) {
                    friendsName = BOT_NAME;
                } else {
                    friendsName = Meteor.users.findOne(from).profile.firstName;   
                }
                return friendsName;
            }
        }, "formatTime": function(date) {
            // Code from http://stackoverflow.com/questions/25275696/javascript-format-date-time 
            // to format time

            var hours = date.getHours();
            var minutes = date.getMinutes();
            var ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            minutes = minutes < 10 ? '0'+minutes : minutes;
            var formattedTime = hours + ':' + minutes + ' ' + ampm;


            // Format date
            var monthNames = [
              "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul",
              "Aug", "Sep", "Oct", "Nov", "Dec"
            ];

            var day = date.getDate();
            var monthIndex = date.getMonth();
            var year = date.getFullYear();

            var formattedDate = day + ' ' + monthNames[monthIndex] + ' ' + year;

            return formattedTime + " on " + formattedDate;
        }
    });

    Template.chatWindow.events({
        "click .removeFriend": function(event) {
            event.preventDefault();
            var currentUser = Meteor.userId();
            var friendId = this._id;

            Meteor.call("removeFriend", currentUser, friendId);
        }, "click .friendsList .friend": function(event) {
            event.preventDefault();
            var friendId = this._id;

            Session.set("chattingWith", friendId);
        }, "keyup .chatBottom input[name='message']": function(event) {
            if(event.which == 13){
                var currentUser = Meteor.userId();
                var chattingWith = Session.get("chattingWith");
                var text = $(event.target).val();
                var users = [currentUser, chattingWith].sort();
                var message = {
                    text: text,
                    from: currentUser,
                    sentAt: new Date()
                };

                var chatExists = Chats.findOne({users: users});
                
                if (chatExists) {
                    // I DON'T THINK SORTING BY sentAt is necessary, since
                    // we're pushing onto the end of the messages array

                    Meteor.call("addMessage", users, message);
                } else {
                    Meteor.call("createChatWithFirstMessage", users, message);
                }

                $(event.target).val("");
            }            
        }
    });
}

if (Meteor.isServer) {
    console.log("CHATTER IS RUNNING!");

    ServiceConfiguration.configurations.remove({
        service: 'facebook'
    });
     
    ServiceConfiguration.configurations.insert({
        service: 'facebook',
        appId: '240711099642226',
        secret: '925d26e66a5289345132df1a14d97dcc'
    });

    Accounts.onCreateUser(function(options, user) {
        console.log("New user!");
        user.profile = {
            friends: []
        };

        // idk where options comes from, but this is what the example in 
        // https://docs.meteor.com/api/accounts-multi.html#AccountsServer-onCreateUser
        // did, so i'm going to check if options.profile exists
        if (options.profile) {
            // Cool way to extend an object
            // Reference:
            // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
            user.profile = Object.assign(user.profile, options.profile);
        }

        // should find a better way to get first and last names than splitting full name.
        if (user.profile.name) {
            // because javascript is dumb
            Array.prototype.last = function() {
                return this[this.length-1];
            }

            var fullName = user.profile.name;
            var firstName = fullName.split(" ")[0];
            var lastName = fullName.split(" ").last();

            user.profile.firstName = firstName;
            user.profile.lastName = lastName;
        }

        console.log(user);

        return user;
    });
}

Meteor.methods({
    "addFriend": function(currentUser, newFriendId) {
        var userProfile = Meteor.users.findOne({_id: currentUser}).profile;
        userProfile.friends.push(newFriendId);

        Meteor.users.update({_id: currentUser}, {$set: {profile: userProfile}});

        var friendProfile = Meteor.users.findOne({_id: newFriendId}).profile;
        friendProfile.friends.push(currentUser);

        Meteor.users.update({_id: newFriendId}, {$set: {profile: friendProfile}});
    }, "removeFriend": function(currentUser, friendId) {
        var userProfile = Meteor.users.findOne({_id: currentUser}).profile;
        // Removes friend from userProfile.friends
        var indexToRemove = userProfile.friends.indexOf(friendId);
        userProfile.friends.splice(indexToRemove, 1); 

        Meteor.users.update({_id: currentUser}, {$set: {profile: userProfile}});


        var friendProfile = Meteor.users.findOne({_id: friendId}).profile;
        // Removes currentUser from friendProfile.friends
        indexToRemove = friendProfile.friends.indexOf(currentUser);
        friendProfile.friends.splice(indexToRemove, 1); 

        Meteor.users.update({_id: friendId}, {$set: {profile: friendProfile}});
    }, "createChatWithFirstMessage": function(between, message) {
        var messages = [message];
        Chats.insert({
            users: between,
            messages: messages
        });
    }, "addMessage": function(between, newMessage) {
        var newMessages = Chats.findOne({users: between}).messages;
        newMessages.push(message);

        Chats.update({users: between}, {
            $set: {
                messages: newMessages
            }
        });
    }
});