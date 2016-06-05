const BOT_ID = "BOT";
const BOT_NAME = "Chatter";


Chats = new Mongo.Collection("Chats");

Router.configure({
    layoutTemplate: "main"
});

Router.route("/", {
    template: "home"
});
Router.route("/register");
Router.route("/login");



if (Meteor.isClient) {
    Session.set("selectedButton", "none");

    // Probably should move this line somewhere else so that when the user
    // refreshes the page, who they're talking to is remembered.
    Session.set("chattingWith", "none");

    $.validator.setDefaults({
        rules: {
            firstName: {
                required: true,
                minlength: 2,
                maxlength: 30
            },
            lastName: {
                required: true,
                minlength: 2,
                maxlength: 30
            },
            email: {
                required: true,
                email: true
            },
            password: {
                required: true,
                minlength: 6
            }
        },
        messages: {
            firstName: {
                required: "You must enter a first name.",
                minlength: "Your first name must be at least {0} characters.",
                maxlength: "Your first name must be at most {0} characters."
            },
            lastName: {
                required: "You must enter a last name.",
                minlength: "Your last name must be at least {0} characters.",
                maxlength: "Your last name must be at most {0} characters."
            },
            email: {
                required: "You must enter an email address.",
                email: "You've entered an invalid email address."
            },
            password: {
                required: "You must enter a password.",
                minlength: "Your password must be at least {0} characters."
            }
        }
    });

    Template.notLoggedIn.helpers({
        "showRegister": function() {
            return Session.get("selectedButton") == "register";
        }, "showLogin": function() {
            return Session.get("selectedButton") == "login";
        }
    });

    Template.home.events({
        "click .register": function() {
            Session.set("selectedButton", "register");
        }, "click .login": function() {
            Session.set("selectedButton", "login");
        }
    });

    Template.register.events({
       "click .back": function() {
            Session.set("selectedButton", "none");
       }, "submit form.register": function(event) {
            event.preventDefault();
       }
    });

    Template.register.onRendered(function() {
        var validator = $('.register').validate({
            submitHandler: function() {
                var firstName = $('[name=firstName]').val();
                var lastName = $('[name=lastName]').val();
                var email = $('[name=email]').val();
                var password = $('[name=password]').val();

                var userProfile = {
                    firstName: firstName,
                    lastName: lastName,
                    fullName: firstName + " " + lastName,
                    friends: []
                }

                Accounts.createUser({
                    profile: userProfile,
                    email: email,
                    password: password
                }, function(error) {
                    if (error) {
                        if(error.reason == "Email already exists."){
                            validator.showErrors({
                                email: "That email already belongs to a registered user."   
                            });
                        }
                    }
                });
            }
        });
    });

    Template.login.events({
       "click .back": function() {
            Session.set("selectedButton", "none");
       }, "submit form.login": function(event) {
            event.preventDefault();
       }
    });

    Template.login.onRendered(function() {
        var validator = $("form.login").validate({
            submitHandler: function(event) {
                var email = $('[name=email]').val();
                var password = $('[name=password]').val();

                Meteor.loginWithPassword(email, password, function(error){
                    if(error){
                        if(error.reason == "User not found"){
                            validator.showErrors({
                                email: "That email doesn't belong to a registered user."   
                            });
                        }
                        if(error.reason == "Incorrect password"){
                            validator.showErrors({
                                password: "You entered an incorrect password."    
                            });
                        }
                    }
                });
            }
        });
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
            Session.set("selectedButton", "none");
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
                console.log(messages);
                return messages;
            } else {
                var chattingWithName = Meteor.users.findOne(chattingWith).profile.firstName;
                var greeting = "Say hello to " + chattingWithName + "!";
                var message = {
                    text: greeting,
                    from: BOT_ID,
                    sentAt: new Date()
                };

                console.log(message);
                return [message];
            }
        }, "fromWhom": function(from) {
            var currentUser = Meteor.userId();

            if (from == currentUser) {
                return "You"
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
                    var newMessages = Chats.findOne({users: users}).messages;
                    console.log(newMessages);
                    newMessages.push(message);

                    // I DON'T THINK SORTING BY sentAt is necessary, since
                    // we're pushing onto the end of the messages array

                    Meteor.call("updateChat", users, newMessages);

                    console.log(Chats.find({users: users}).fetch());
                } else {
                    var messages = [message];

                    Meteor.call("addChat", users, messages);

                    console.log(Chats.find({users: users}).fetch());
                }

                $(event.target).val("");
            }            
        }
    });
}

if (Meteor.isServer) {
    console.log("CHATTER IS RUNNING!");
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
    }, "addChat": function(between, messages) {
        Chats.insert({
            users: between,
            messages: messages
        });
    }, "updateChat": function(between, newMessages) {
        Chats.update({users: between}, {
            $set: {
                messages: newMessages
            }
        });
    }
});