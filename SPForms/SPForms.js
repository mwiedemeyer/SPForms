///#source 1 1 SPForms_Main.js
/// <reference path="SPForms_Profile.ts" />
/// <reference path="SPForms_Fields.ts" />
/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="Scripts/typings/jqueryui/jqueryui.d.ts" />
/// <reference path="Scripts/typings/sharepoint/SharePoint.d.ts" />
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

        FormManager.prototype.initialize = function () {
            var _this = this;
            this.settings = JSON.parse(this.form.attr("data-form-settings"));

            this.initJQueryUIDefaults();

            // initialize all form fields
            this.form.find("[data-form-field]").each(function (i, f) {
                var field = SPForms.FormFields.FormField.getFormFieldByType($(f));
                _this.fields.push(field);
            });

            this.wireUpEvents();
            this.populateFieldsFromQueryString();
            this.loadProfileData();
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
            if (this.settings.maxParticipants === undefined || this.settings.maxParticipants < 1) {
                this.createListItemInternal(deferred, context, list);
            } else {
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

                listItem.set_item(fieldName, content);
            });

            listItem.update();
            context.executeQueryAsync(function () {
                deferred.resolve();
            }, function (sender, args) {
                deferred.reject(args.get_message());
            });
        };

        FormManager.prototype.initJQueryUIDefaults = function () {
            $.datepicker.regional["de"] = {
                clearText: "löschen",
                clearStatus: "aktuelles Datum löschen",
                closeText: "schließen",
                closeStatus: "ohne Änderungen schließen",
                prevText: "Zurück",
                prevStatus: "letzten Monat zeigen",
                nextText: "Vor",
                nextStatus: "nächsten Monat zeigen",
                currentText: "heute",
                currentStatus: "",
                monthNames: [
                    "Januar",
                    "Februar",
                    "März",
                    "April",
                    "Mai",
                    "Juni",
                    "Juli",
                    "August",
                    "September",
                    "Oktober",
                    "November",
                    "Dezember"
                ],
                monthNamesShort: [
                    "Jan",
                    "Feb",
                    "Mär",
                    "Apr",
                    "Mai",
                    "Jun",
                    "Jul",
                    "Aug",
                    "Sep",
                    "Okt",
                    "Nov",
                    "Dez"
                ],
                monthStatus: "anderen Monat anzeigen",
                yearStatus: "anderes Jahr anzeigen",
                weekHeader: "Wo",
                weekStatus: "Woche des Monats",
                dayNames: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
                dayNamesShort: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
                dayNamesMin: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
                dayStatus: "Setze DD als ersten Wochentag",
                dateStatus: "Wähle D, M d",
                dateFormat: "dd.mm.yy",
                firstDay: 1,
                initStatus: "Datum auswählen",
                isRTL: false
            };
            $.datepicker.setDefaults($.datepicker.regional["de"]);
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
        return Helper;
    })();
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
//#endregion
//# sourceMappingURL=SPForms_Main.js.map

///#source 1 1 SPForms_Fields.js
/// <reference path="SPForms_PeoplePicker2010.ts" />
/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="Scripts/typings/jqueryui/jqueryui.d.ts" />
/// <reference path="Scripts/typings/sharepoint/SharePoint.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var SPForms;
(function (SPForms) {
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
                switch (FormField.get_type(internalField)) {
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

            FormField.get_type = function (internalField) {
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
                return FormField.get_type(this.internalField);
            };

            FormField.prototype.get_value = function () {
                return this.internalField.val();
            };

            FormField.prototype.set_value = function (val) {
                this.internalField.val(val);
            };

            FormField.prototype.get_isrequired = function () {
                return (this.internalField.attr("data-form-required") !== undefined);
            };

            FormField.prototype.get_validatorExpression = function () {
                return this.internalField.attr("data-form-validate");
            };

            FormField.prototype.get_isProfileField = function () {
                return (this.internalField.attr("data-form-profile") !== undefined);
            };

            FormField.prototype.get_profileProperty = function () {
                try  {
                    return ProfileProperty[this.internalField.attr("data-form-profile")];
                } catch (e) {
                    return 0 /* Unknown */;
                }
            };

            //#endregion
            FormField.prototype.validate = function () {
                if (this.get_isrequired() && this.get_value().length === 0) {
                    this.internalField.addClass("form-invalid");
                    this.internalField.tooltip({
                        items: "[id=" + this.internalField.attr('ID') + "]",
                        content: this.internalField.attr("data-form-validationmessage"),
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

                var ppMode = internalField.attr("data-form-peoplepicker");
                if (ppMode === "2010") {
                    this.internalField.prop("disabled", "disabled");

                    this.peoplePicker = new SPForms.PeoplePicker2010(this.internalField.attr("id"));
                    var button = $('<img src="/Scripts/images/addressbook.gif" style="margin-left: 5px; vertical-align: bottom; cursor: pointer;" />');
                    button.click(function () {
                        _this.peoplePicker.openPeoplePicker();
                    });

                    this.internalField.after(button);
                } else if (ppMode === "2013") {
                }
            }
            PeopleFormField.prototype.get_value = function () {
                switch (this.internalField.attr("data-form-field-value")) {
                    case "displayname":
                        return this.internalField.attr("data-people-display");
                    case "email":
                        return this.internalField.attr("data-people-email");
                    case "accountname":
                    default:
                        return this.internalField.attr("data-people-account");
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
    })(SPForms.FormFields || (SPForms.FormFields = {}));
    var FormFields = SPForms.FormFields;
})(SPForms || (SPForms = {}));
//# sourceMappingURL=SPForms_Fields.js.map

///#source 1 1 SPForms_PeoplePicker2010.js
/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="Scripts/typings/jqueryui/jqueryui.d.ts" />
/// <reference path="Scripts/typings/sharepoint/SharePoint.d.ts" />
var SPForms;
(function (SPForms) {
    var PeoplePicker2010 = (function () {
        function PeoplePicker2010(textBoxId) {
            this.textBox = $("#" + textBoxId);
        }
        PeoplePicker2010.prototype.openPeoplePicker = function () {
            var _this = this;
            var dialogOptions = 'resizable:yes; status:no; scroll:no; help:no; center:yes; dialogWidth :575px; dialogHeight :500px;';
            var dialogURL = '/_layouts/picker.aspx';
            dialogURL += '?MultiSelect=False';
            dialogURL += '&CustomProperty=User,SecGroup,SPGroup;;15;;;False';
            dialogURL += '&EntitySeparator=;';
            dialogURL += '&DialogTitle=Select People and Groups';
            dialogURL += '&DialogImage=/_layouts/images/ppeople.gif';
            dialogURL += '&PickerDialogType=Microsoft.SharePoint.WebControls.PeoplePickerDialog, Microsoft.SharePoint, Version=12.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c';
            dialogURL += '&DefaultSearch=';

            commonShowModalDialog(dialogURL, dialogOptions, function (sr) {
                _this.peoplePickerCallback(sr);
            });
        };

        PeoplePicker2010.prototype.peoplePickerCallback = function (searchResult) {
            var xmlDoc = $.parseXML(searchResult);
            var $xml = $(xmlDoc);
            var account = $xml.find('Entity').attr('Key');
            var display = $xml.find('Entity').attr('DisplayText');
            var extraData = $xml.find('Entity ExtraData ArrayOfDictionaryEntry');
            var email = extraData.find('Key:contains("Email")').next().text();

            if (this.textBox.val() != null) {
                // multi select
                //if (this.textBox.val() != '') {
                //    var contactPerson = this.textBox.val();
                //    this.textBox.val(contactPerson + "; " + fqn);
                //}
                this.textBox.val(display);
                this.textBox.attr("data-people-display", display);
                this.textBox.attr("data-people-account", account);
                this.textBox.attr("data-people-email", email);
                this.textBox.focus();
            }

            return;
        };
        return PeoplePicker2010;
    })();
    SPForms.PeoplePicker2010 = PeoplePicker2010;
})(SPForms || (SPForms = {}));
//# sourceMappingURL=SPForms_PeoplePicker2010.js.map

///#source 1 1 SPForms_Profile.js
var SPForms;
(function (SPForms) {
    /// <reference path="Scripts/typings/spservices/SPServices.d.ts" />
    /// <reference path="Scripts/typings/jquery/jquery.d.ts" />
    /// <reference path="Scripts/typings/jqueryui/jqueryui.d.ts" />
    /// <reference path="Scripts/typings/sharepoint/SharePoint.d.ts" />
    (function (Profile) {
        var ProfileManager = (function () {
            function ProfileManager() {
            }
            ProfileManager.getProfileAsync = function () {
                var deferred = $.Deferred();

                var userData = {};

                var params = {
                    operation: 'GetUserProfileByName',
                    async: true,
                    completefunc: function (xData, Status) {
                        $(xData.responseXML).SPFilterNode("PropertyData").each(function () {
                            if ($(this).find("Name").text() === "PreferredName")
                                userData.displayName = $(this).find("Value").text();
                            if ($(this).find("Name").text() === "FirstName")
                                userData.firstName = $(this).find("Value").text();
                            if ($(this).find("Name").text() === "LastName")
                                userData.lastName = $(this).find("Value").text();
                            if ($(this).find("Name").text() === "WorkPhone")
                                userData.phone = $(this).find("Value").text();
                            if ($(this).find("Name").text() === "Department")
                                userData.department = $(this).find("Value").text();
                            if ($(this).find("Name").text() === "Title")
                                userData.title = $(this).find("Value").text();
                            if ($(this).find("Name").text() === "WorkEmail")
                                userData.email = $(this).find("Value").text();
                            if ($(this).find("Name").text() === "otg-Company")
                                userData.company = $(this).find("Value").text();
                        });

                        deferred.resolve(userData);
                    },
                    accountName: $().SPServices.SPGetCurrentUser({
                        fieldName: "Name"
                    })
                };

                $().SPServices(params);

                return deferred.promise();
            };
            return ProfileManager;
        })();
        Profile.ProfileManager = ProfileManager;
    })(SPForms.Profile || (SPForms.Profile = {}));
    var Profile = SPForms.Profile;
})(SPForms || (SPForms = {}));
//# sourceMappingURL=SPForms_Profile.js.map

