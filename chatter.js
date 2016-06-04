Chats = new Mongo.Collection("chats");

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
        }
    });

    Template.chatWindow.events({
        "click .removeFriend": function(event) {
            event.preventDefault();
            var currentUser = Meteor.userId();
            var friendId = this._id;

            Meteor.call("removeFriend", currentUser, friendId);
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
    }
});