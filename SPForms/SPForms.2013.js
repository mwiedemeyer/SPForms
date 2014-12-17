///#source 1 1 /SPForms_Main.js
var SPForms;
(function (SPForms) {
    var FormManager = (function () {
        function FormManager(formId) {
            this.fields = [];
            this.form = $("#" + formId);
        }
        FormManager.init = function (formId) {
            var f = new FormManager(formId);
            f.initialize();
            return f;
        };
        // Reload all fields
        // You should call this method if you changed data - form attributes on HTML elements
        FormManager.prototype.reloadFields = function () {
            var _this = this;
            this.fields = [];
            this.form.find("[data-form-field]").each(function (i, f) {
                var field = SPForms.FormFields.FormField.getFormFieldByType($(f));
                _this.fields.push(field);
            });
            this.populateFieldsFromQueryString();
            this.loadProfileData();
        };
        FormManager.prototype.initialize = function () {
            var settingsAttr = this.form.attr("data-form-settings");
            if (settingsAttr !== null && settingsAttr !== undefined)
                this.settings = JSON.parse(settingsAttr);
            else
                this.settings = null;
            this.reloadFields();
            this.wireUpEvents();
        };
        // Attach events to controls
        FormManager.prototype.wireUpEvents = function () {
            var _this = this;
            // wire up submit button
            this.form.find("[data-form-submit]").click(function (el) {
                var button = $(el.target);
                var listName = button.attr("data-form-submit-list");
                // remove 'invalid' css from all elements and remove tooltips
                $("[data-form-field]").removeClass("form-invalid");
                $("[data-form-field]").tooltip(); //init if not yet initalized
                $("[data-form-field]").tooltip("option", "disabled", true);
                if (!_this.validateControls()) {
                    return;
                }
                _this.createListItem(listName).done(function () {
                    var onSuccessFunction = button.attr("data-form-submit-onsuccess");
                    if (onSuccessFunction !== undefined) {
                        window[onSuccessFunction]();
                    }
                }).fail(function (message) {
                    var onFailedFunction = button.attr("data-form-submit-onfailed");
                    if (onFailedFunction !== undefined) {
                        window[onFailedFunction](message);
                    }
                });
            });
        };
        // Set field values if defined in QueryString
        FormManager.prototype.populateFieldsFromQueryString = function () {
            var par = Helper.getParameters();
            if (par === null)
                return;
            // check if parameter begins with "form-" and set the fields value
            par.forEach(function (p) {
                if (p.key.indexOf("form-") > -1) {
                    var fieldName = p.key.substring(5);
                    if ($("[data-form-field=" + fieldName + "]").length > 0)
                        $("[data-form-field=" + fieldName + "]").val(decodeURIComponent(p.value));
                }
            });
        };
        // load profile data if at least one field requires profile information
        FormManager.prototype.loadProfileData = function () {
            var _this = this;
            var isAtLeastOneProfileFieldDefined = false;
            this.fields.forEach(function (field) {
                if (field.get_isProfileField()) {
                    isAtLeastOneProfileFieldDefined = true;
                }
            });
            if (!isAtLeastOneProfileFieldDefined)
                return;
            SPForms.Profile.ProfileManager.getProfileAsync().done(function (data) {
                _this.fields.forEach(function (field) {
                    var profileProperty = field.get_profileProperty();
                    switch (profileProperty) {
                        case 1 /* DisplayName */:
                            field.set_value(data.displayName);
                            break;
                        case 2 /* FirstName */:
                            field.set_value(data.firstName);
                            break;
                        case 3 /* LastName */:
                            field.set_value(data.lastName);
                            break;
                        case 7 /* Phone */:
                            field.set_value(data.phone);
                            break;
                        case 6 /* Department */:
                            field.set_value(data.department);
                            break;
                        case 8 /* Title */:
                            field.set_value(data.title);
                            break;
                        case 4 /* EMail */:
                            field.set_value(data.email);
                            break;
                        case 5 /* Company */:
                            field.set_value(data.company);
                            break;
                        case 0 /* Unknown */:
                        default:
                            break;
                    }
                });
            });
        };
        // Validate all field controls
        FormManager.prototype.validateControls = function () {
            var isValid = true;
            this.fields.forEach(function (f) {
                if (!f.validate()) {
                    isValid = false;
                    return;
                }
            });
            return isValid;
        };
        // Create SharePoint list item from fields
        FormManager.prototype.createListItem = function (listName) {
            var _this = this;
            var deferred = $.Deferred();
            var context = new SP.ClientContext();
            var web = context.get_web();
            var list = web.get_lists().getByTitle(listName);
            // check for max participants before adding the new item
            if (this.settings === null || this.settings.maxParticipants === undefined || this.settings.maxParticipants < 1) {
                this.createListItemInternal(deferred, context, list);
            }
            else {
                context.load(list, 'ItemCount');
                context.executeQueryAsync(function () {
                    if (list.get_itemCount() >= _this.settings.maxParticipants) {
                        deferred.reject("Error: MaxParticipants");
                        return;
                    }
                    _this.createListItemInternal(deferred, context, list);
                }, function (sender, args) {
                    deferred.reject(args.get_message());
                });
            }
            return deferred.promise();
        };
        FormManager.prototype.createListItemInternal = function (deferred, context, list) {
            var lc = new SP.ListItemCreationInformation();
            var listItem = list.addItem(lc);
            this.fields.forEach(function (field) {
                var fieldName = field.get_name();
                var content = field.get_value();
                if (field.get_type() === 3 /* PeoplePicker */) {
                    if (content !== null && content !== "") {
                        var web = context.get_web();
                        content = web.ensureUser(content);
                    }
                    else {
                        content = null;
                    }
                }
                listItem.set_item(fieldName, content);
            });
            listItem.update();
            context.executeQueryAsync(function () {
                deferred.resolve();
            }, function (sender, args) {
                deferred.reject(args.get_message());
            });
        };
        return FormManager;
    })();
    SPForms.FormManager = FormManager;
    var Helper = (function () {
        function Helper() {
        }
        Helper.getParameters = function () {
            var par = [];
            var query = window.location.search.substring(1);
            if (query === "")
                return null;
            var vars = query.split("&");
            for (var i = 0; i < vars.length; i++) {
                var pair = vars[i].split("=");
                var p = {
                    key: pair[0],
                    value: pair[1]
                };
                par.push(p);
            }
            return par;
        };
        Helper.getSPVersion = function () {
            if (_spPageContextInfo.webUIVersion === 15) {
                return 2013;
            }
            return 2010;
        };
        return Helper;
    })();
    SPForms.Helper = Helper;
})(SPForms || (SPForms = {}));
//#region forEach implementation for older browser (<IE9)
if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (f) {
        var len = this.length;
        if (typeof f != "function")
            throw new TypeError();
        var thisp = arguments[1];
        for (var i = 0; i < len; i++) {
            if (i in this)
                f.call(thisp, this[i], i, this);
        }
    };
}
//# sourceMappingURL=SPForms_Main.js.map
///#source 1 1 /SPForms_Fields.js
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var SPForms;
(function (SPForms) {
    var FormFields;
    (function (FormFields) {
        (function (FormFieldType) {
            FormFieldType[FormFieldType["Text"] = 0] = "Text";
            FormFieldType[FormFieldType["Radio"] = 1] = "Radio";
            FormFieldType[FormFieldType["DatePicker"] = 2] = "DatePicker";
            FormFieldType[FormFieldType["PeoplePicker"] = 3] = "PeoplePicker";
        })(FormFields.FormFieldType || (FormFields.FormFieldType = {}));
        var FormFieldType = FormFields.FormFieldType;
        (function (ProfileProperty) {
            ProfileProperty[ProfileProperty["Unknown"] = 0] = "Unknown";
            ProfileProperty[ProfileProperty["DisplayName"] = 1] = "DisplayName";
            ProfileProperty[ProfileProperty["FirstName"] = 2] = "FirstName";
            ProfileProperty[ProfileProperty["LastName"] = 3] = "LastName";
            ProfileProperty[ProfileProperty["EMail"] = 4] = "EMail";
            ProfileProperty[ProfileProperty["Company"] = 5] = "Company";
            ProfileProperty[ProfileProperty["Department"] = 6] = "Department";
            ProfileProperty[ProfileProperty["Phone"] = 7] = "Phone";
            ProfileProperty[ProfileProperty["Title"] = 8] = "Title";
        })(FormFields.ProfileProperty || (FormFields.ProfileProperty = {}));
        var ProfileProperty = FormFields.ProfileProperty;
        var FormField = (function () {
            //#endregion
            function FormField(internalField) {
                this.internalField = internalField;
                if (this.get_isrequired()) {
                    var label = $("label[for=" + this.internalField.attr("id") + "]");
                    if (label.length > 0)
                        label.append('<span style="color: red;"> *</span>');
                }
            }
            //#region static methods to get field by type
            FormField.getFormFieldByType = function (internalField) {
                switch (FormField.getFormFieldType(internalField)) {
                    case 1 /* Radio */:
                        return new RadioFormField(internalField);
                    case 3 /* PeoplePicker */:
                        return new PeopleFormField(internalField);
                    case 2 /* DatePicker */:
                        return new DatePickerField(internalField);
                    case 0 /* Text */:
                    default:
                        return new FormField(internalField);
                }
            };
            FormField.getFormFieldType = function (internalField) {
                var type = internalField.attr("type");
                switch (type) {
                    case "radio":
                        return 1 /* Radio */;
                    case "text":
                    default:
                        if (internalField.attr("data-form-peoplepicker") !== undefined)
                            return 3 /* PeoplePicker */;
                        if (internalField.attr("data-form-datepicker") !== undefined)
                            return 2 /* DatePicker */;
                        return 0 /* Text */;
                }
            };
            //#region Properties
            FormField.prototype.get_name = function () {
                return this.internalField.attr("data-form-field");
            };
            FormField.prototype.get_type = function () {
                return FormField.getFormFieldType(this.internalField);
            };
            FormField.prototype.get_value = function () {
                return this.internalField.val();
            };
            FormField.prototype.set_value = function (val) {
                this.internalField.val(val);
            };
            FormField.prototype.get_isrequired = function () {
                if (!this.internalField.is(":visible"))
                    return false;
                return (this.internalField.attr("data-form-required") !== undefined);
            };
            FormField.prototype.get_validatorExpression = function () {
                return this.internalField.attr("data-form-validate");
            };
            FormField.prototype.get_isProfileField = function () {
                return (this.internalField.attr("data-form-profile") !== undefined);
            };
            FormField.prototype.get_profileProperty = function () {
                try {
                    return ProfileProperty[this.internalField.attr("data-form-profile")];
                }
                catch (e) {
                    return 0 /* Unknown */;
                }
            };
            //#endregion
            FormField.prototype.validate = function () {
                if (this.get_isrequired() && this.get_value().length === 0) {
                    var validationMessage = this.internalField.attr("data-form-validationmessage") || "Required";
                    this.internalField.addClass("form-invalid");
                    this.internalField.tooltip({
                        items: "[id=" + this.internalField.attr('ID') + "]",
                        content: validationMessage,
                        disabled: false
                    });
                    return false;
                }
                var validatorExp = this.get_validatorExpression();
                if (validatorExp !== undefined) {
                    var regex = new RegExp(validatorExp);
                    if (!regex.test(this.get_value())) {
                        this.internalField.addClass("form-invalid");
                        this.internalField.tooltip({
                            items: "[id=" + this.internalField.attr('ID') + "]",
                            content: this.internalField.attr("data-form-validationmessage"),
                            disabled: false
                        });
                        return false;
                    }
                }
                return true;
            };
            return FormField;
        })();
        FormFields.FormField = FormField;
        var RadioFormField = (function (_super) {
            __extends(RadioFormField, _super);
            function RadioFormField() {
                _super.apply(this, arguments);
            }
            RadioFormField.prototype.get_value = function () {
                var groupName = this.internalField.attr("name");
                return $("[name=" + groupName + "]:checked").val();
            };
            return RadioFormField;
        })(FormField);
        FormFields.RadioFormField = RadioFormField;
        var PeopleFormField = (function (_super) {
            __extends(PeopleFormField, _super);
            function PeopleFormField(internalField) {
                var _this = this;
                _super.call(this, internalField);
                this.peoplePickerMode = SPForms.Helper.getSPVersion();
                if (this.peoplePickerMode === 2010) {
                    this.internalField.prop("disabled", "disabled");
                    this.peoplePicker2010 = new SPForms.PeoplePicker2010(this.internalField.attr("id"));
                    var button = $('<img src="/Scripts/images/addressbook.gif" style="margin-left: 5px; vertical-align: bottom; cursor: pointer;" />');
                    button.click(function () {
                        _this.peoplePicker2010.openPeoplePicker();
                    });
                    this.internalField.after(button);
                }
                else if (this.peoplePickerMode === 2013) {
                    var origId = this.internalField.attr("id");
                    var divId = origId + "_div";
                    this.internalField.hide();
                    var div = $('<div id="' + divId + '"></div>');
                    this.internalField.after(div);
                    this.peoplePicker2013 = new SPForms.PeoplePicker2013(divId);
                    this.peoplePicker2013.initAsync();
                }
            }
            PeopleFormField.prototype.get_value = function () {
                if (this.peoplePickerMode === 2010) {
                    switch (this.internalField.attr("data-form-peoplepicker-value")) {
                        case "displayname":
                            return this.internalField.attr("data-people-display");
                        case "email":
                            return this.internalField.attr("data-people-email");
                        case "accountname":
                        default:
                            return this.internalField.attr("data-people-account");
                    }
                }
                else if (this.peoplePickerMode === 2013) {
                    return this.peoplePicker2013.getSelectedAccountName();
                }
            };
            return PeopleFormField;
        })(FormField);
        FormFields.PeopleFormField = PeopleFormField;
        var DatePickerField = (function (_super) {
            __extends(DatePickerField, _super);
            function DatePickerField(internalField) {
                _super.call(this, internalField);
                this.internalField.datepicker();
            }
            return DatePickerField;
        })(FormField);
        FormFields.DatePickerField = DatePickerField;
    })(FormFields = SPForms.FormFields || (SPForms.FormFields = {}));
})(SPForms || (SPForms = {}));
//# sourceMappingURL=SPForms_Fields.js.map
///#source 1 1 /SPForms_PeoplePicker2013.js
var SPForms;
(function (SPForms) {
    var PeoplePicker2013 = (function () {
        function PeoplePicker2013(divId) {
            this.divId = divId;
        }
        PeoplePicker2013.prototype.initAsync = function () {
            var _this = this;
            SP.SOD.loadMultiple(['sp.js', 'sp.runtime.js', 'sp.core.js', 'clienttemplates.js'], function () {
                // enable people picker
                var schema = {};
                schema['PrincipalAccountType'] = 'User,DL,SecGroup,SPGroup';
                schema['SearchPrincipalSource'] = 15;
                schema['ResolvePrincipalSource'] = 15;
                schema['AllowMultipleValues'] = false;
                schema['MaximumEntitySuggestions'] = 50;
                schema['Width'] = '280px';
                SPClientPeoplePicker.InitializeStandalonePeoplePicker(_this.divId, null, schema);
            });
        };
        PeoplePicker2013.prototype.getSelectedAccountName = function () {
            var pp = SPClientPeoplePicker.SPClientPeoplePickerDict[this.divId + "_TopSpan"];
            var accounts = pp.GetAllUserInfo();
            if (accounts.length == 0)
                return "";
            return accounts[0].Key;
        };
        return PeoplePicker2013;
    })();
    SPForms.PeoplePicker2013 = PeoplePicker2013;
})(SPForms || (SPForms = {}));
//# sourceMappingURL=SPForms_PeoplePicker2013.js.map
///#source 1 1 /SPForms_ProfileBase.js
var SPForms;
(function (SPForms) {
    var Profile;
    (function (Profile) {
        var ProfileManager = (function () {
            function ProfileManager() {
            }
            ProfileManager.getProfileAsync = function () {
                if (SPForms.Helper.getSPVersion() === 2013) {
                    return Profile.ProfileManager2013.getProfileAsync();
                }
                else {
                    return Profile.ProfileManager2010.getProfileAsync();
                }
            };
            return ProfileManager;
        })();
        Profile.ProfileManager = ProfileManager;
    })(Profile = SPForms.Profile || (SPForms.Profile = {}));
})(SPForms || (SPForms = {}));
//# sourceMappingURL=SPForms_ProfileBase.js.map
///#source 1 1 /SPForms_Profile2013.js
var SPForms;
(function (SPForms) {
    var Profile;
    (function (Profile) {
        var ProfileManager2013 = (function () {
            function ProfileManager2013() {
            }
            ProfileManager2013.getProfileAsync = function () {
                var deferred = $.Deferred();
                var userData = {};
                SP.SOD.loadMultiple(['sp.js', 'userprofile'], function () {
                    var context = SP.ClientContext.get_current();
                    var peopleManager = new SP.UserProfiles.PeopleManager(context);
                    var currentUser = context.get_web().get_currentUser();
                    context.load(currentUser);
                    context.executeQueryAsync(function () {
                        var targetUser = currentUser.get_loginName();
                        var profilePropertyNames = ["PreferredName", "FirstName", "LastName", "WorkPhone", "Department", "Title", "WorkEmail"];
                        var userProfilePropertiesForUser = new SP.UserProfiles.UserProfilePropertiesForUser(context, targetUser, profilePropertyNames);
                        var properties = peopleManager.getUserProfilePropertiesFor(userProfilePropertiesForUser);
                        context.load(userProfilePropertiesForUser);
                        context.executeQueryAsync(function (sender, args) {
                            userData.displayName = properties[0];
                            userData.firstName = properties[1];
                            userData.lastName = properties[2];
                            userData.phone = properties[3];
                            userData.department = properties[4];
                            userData.title = properties[5];
                            userData.email = properties[6];
                            deferred.resolve(userData);
                        }, function (sender, args) {
                        });
                    }, function () {
                    });
                });
                return deferred.promise();
            };
            return ProfileManager2013;
        })();
        Profile.ProfileManager2013 = ProfileManager2013;
    })(Profile = SPForms.Profile || (SPForms.Profile = {}));
})(SPForms || (SPForms = {}));
//# sourceMappingURL=SPForms_Profile2013.js.map
