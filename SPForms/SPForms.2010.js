///#source 1 1 /SPForms_Main.js
var SPForms;
(function (SPForms) {
    var FormManager = (function () {
        function FormManager(formId) {
            this.fields = [];
            this.isEdit = false;
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
                var field = SPForms.FormFields.FormField.getFormField($(f));
                _this.fields.push(field);
            });
            this.populateFieldsFromQueryString();
            if (!this.isEdit)
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
                    var onValidationErrorFunction = button.attr("data-form-submit-onvalidationerror");
                    if (onValidationErrorFunction !== undefined) {
                        window[onValidationErrorFunction]();
                    }
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
            var _this = this;
            var par = Helper.getParameters();
            if (par === null)
                return;
            // check if parameter begins with "form-" and set the fields value
            par.forEach(function (p) {
                if (p.key === "form-edit-id") {
                    _this.isEdit = true;
                    _this.loadExistingItem(parseInt(p.value, 10));
                    return;
                }
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
                        case SPForms.FormFields.ProfileProperty.DisplayName:
                            field.set_value(data.displayName);
                            break;
                        case SPForms.FormFields.ProfileProperty.FirstName:
                            field.set_value(data.firstName);
                            break;
                        case SPForms.FormFields.ProfileProperty.LastName:
                            field.set_value(data.lastName);
                            break;
                        case SPForms.FormFields.ProfileProperty.Phone:
                            field.set_value(data.phone);
                            break;
                        case SPForms.FormFields.ProfileProperty.Department:
                            field.set_value(data.department);
                            break;
                        case SPForms.FormFields.ProfileProperty.Title:
                            field.set_value(data.title);
                            break;
                        case SPForms.FormFields.ProfileProperty.EMail:
                            field.set_value(data.email);
                            break;
                        case SPForms.FormFields.ProfileProperty.Company:
                            field.set_value(data.company);
                            break;
                        case SPForms.FormFields.ProfileProperty.Unknown:
                        default:
                            break;
                    }
                });
            });
        };
        // load existing item into fields
        FormManager.prototype.loadExistingItem = function (itemId) {
            var _this = this;
            var listName = this.form.find("[data-form-submit]").attr("data-form-submit-list");
            SP.SOD.executeOrDelayUntilScriptLoaded(function () {
                var context = new SP.ClientContext();
                var web = context.get_web();
                var list = web.get_lists().getByTitle(listName);
                var item = list.getItemById(itemId);
                context.load(item, "FieldValuesAsText");
                context.executeQueryAsync(function () {
                    var values = item.get_fieldValuesAsText();
                    _this.fields.forEach(function (field) {
                        field.set_value(values.get_item(field.get_name()));
                    });
                }, function (sender, args) {
                });
            }, "sp.js");
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
            if (this.settings === null || this.settings.maxParticipants === undefined || this.settings.maxParticipants < 1 || this.isEdit) {
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
                if (field.get_type() === SPForms.FormFields.FormFieldType.PeoplePicker) {
                    if (content !== null && content !== "") {
                        var web = context.get_web();
                        content = web.ensureUser(content);
                    }
                    else {
                        content = null;
                    }
                    listItem.set_item(fieldName, content);
                }
                else {
                    if (field.internalField.is(":visible") || field.get_includeHidden()) {
                        listItem.set_item(fieldName, content);
                    }
                }
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
//#endregion 
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
            FormFieldType[FormFieldType["DropDown"] = 4] = "DropDown";
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
            FormField.getFormField = function (internalField) {
                switch (FormField.getFormFieldType(internalField)) {
                    case 1 /* Radio */:
                        return new RadioFormField(internalField);
                    case 3 /* PeoplePicker */:
                        return new PeopleFormField(internalField);
                    case 2 /* DatePicker */:
                        return new DatePickerField(internalField);
                    case 4 /* DropDown */:
                        return new DropDownField(internalField);
                    case 0 /* Text */:
                    default:
                        return new FormField(internalField);
                }
            };
            FormField.getFormFieldType = function (internalField) {
                if (internalField.get()[0].tagName.toLowerCase() === "select") {
                    return 4 /* DropDown */;
                }
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
                return (this.internalField.attr("data-form-required") !== undefined && this.internalField.attr("data-form-required") === "true");
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
            FormField.prototype.get_includeHidden = function () {
                return (this.internalField.attr("data-form-includeHidden") !== undefined && this.internalField.attr("data-form-includeHidden") === "true");
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
                return $('[name="' + groupName + '"]:checked').val();
            };
            RadioFormField.prototype.set_value = function (val) {
                var groupName = this.internalField.attr("name");
                $('[name="' + groupName + '"][value="' + val + '"]').prop("checked", "true");
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
        var DropDownField = (function (_super) {
            __extends(DropDownField, _super);
            function DropDownField(internalField) {
                _super.call(this, internalField);
                this._valuesToElementItems = [];
                this._list = internalField.attr("data-form-select-list");
                this._valueColumn = internalField.attr("data-form-select-valueColumn");
                this._isLookup = (this._list !== undefined && this._list !== null && this._list !== "");
                if (this._isLookup) {
                    this._initialOptionElements = $("option", internalField).detach();
                    this.parseValuesToElements(internalField.attr("data-form-select-setValuesToElements"));
                    this.setupDependencies();
                    this.loadList();
                    this.wireupEvents();
                }
            }
            DropDownField.prototype.loadList = function () {
                var _this = this;
                var deferred = $.Deferred();
                SP.SOD.executeOrDelayUntilScriptLoaded(function () {
                    var context = new SP.ClientContext();
                    var web = context.get_web();
                    var list = web.get_lists().getByTitle(_this._list);
                    var items = list.getItems(SP.CamlQuery.createAllItemsQuery());
                    _this._spValueCache = [];
                    $("option", _this.internalField).remove();
                    _this._initialOptionElements.appendTo(_this.internalField);
                    context.load(items);
                    context.executeQueryAsync(function () {
                        for (var i = 0; i < items.get_count(); i++) {
                            var item = items.get_item(i);
                            var val = item.get_item(_this._valueColumn);
                            if (_this._spFilterField === undefined || _this._spFilterField === null || _this._spFilterField === "") {
                                _this.internalField.append('<option value="' + val + '">' + val + '</option>');
                            }
                            else {
                                var filterValue = item.get_item(_this._spFilterField);
                                _this.internalField.append('<option value="' + val + '" data-form-filtervalue="' + filterValue + '">' + val + '</option>');
                            }
                            var cacheItem = {
                                key: val,
                                spItems: []
                            };
                            _this._valuesToElementItems.forEach(function (field) {
                                var spItem = {
                                    key: field.key,
                                    value: item.get_item(field.value)
                                };
                                cacheItem.spItems.push(spItem);
                            });
                            _this._spValueCache.push(cacheItem);
                        }
                        deferred.resolve();
                    }, function (sender, args) {
                        _this.internalField.append('<option value="">ERROR: ' + args.get_message() + '</option>');
                        deferred.reject(args.get_message());
                    });
                }, "sp.js");
                return deferred.promise();
            };
            DropDownField.prototype.wireupEvents = function () {
                var _this = this;
                this.internalField.change(function () {
                    var val = $("option:selected", _this.internalField).val();
                    _this._spValueCache.forEach(function (cacheItem) {
                        if (cacheItem.key === val) {
                            cacheItem.spItems.forEach(function (spItem) {
                                $("#" + spItem.key).text(spItem.value);
                            });
                        }
                    });
                });
            };
            DropDownField.prototype.setupDependencies = function () {
                // Setup depdencies
                var dependencyFilter = this.internalField.attr("data-form-select-dependency-filter");
                if (dependencyFilter === undefined || dependencyFilter === null || dependencyFilter === "") {
                    return;
                }
                // Format: SPColumnOfTheListOfThisDropDown=FormFieldNameOfTheFilterDropDown
                var depSplit = dependencyFilter.split("=");
                this._spFilterField = depSplit[0];
                var filterFromFormField = depSplit[1];
                var _that = this;
                $("[data-form-field=" + filterFromFormField + "]").change(function () {
                    var _this = this;
                    _that.loadList().done(function () {
                        $("option[data-form-filtervalue]option[data-form-filtervalue!='" + $(_this).val() + "']", _that.internalField).remove();
                    });
                });
            };
            DropDownField.prototype.parseValuesToElements = function (valuesToElementsString) {
                // Format: HtmlElementId=SPListFieldName,HtmlElementId2,SPListFieldName2,...
                if (valuesToElementsString === undefined || valuesToElementsString === null || valuesToElementsString === "") {
                    return;
                }
                var split = valuesToElementsString.split(",");
                for (var i = 0; i < split.length; i++) {
                    var parts = split[i].split("=");
                    var vitem = {
                        key: parts[0],
                        value: parts[1]
                    };
                    this._valuesToElementItems.push(vitem);
                }
            };
            return DropDownField;
        })(FormField);
        FormFields.DropDownField = DropDownField;
    })(FormFields = SPForms.FormFields || (SPForms.FormFields = {}));
})(SPForms || (SPForms = {}));
//# sourceMappingURL=SPForms_Fields.js.map
///#source 1 1 /SPForms_PeoplePicker2010.js
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
        };
        return PeoplePicker2010;
    })();
    SPForms.PeoplePicker2010 = PeoplePicker2010;
})(SPForms || (SPForms = {}));
//# sourceMappingURL=SPForms_PeoplePicker2010.js.map
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
///#source 1 1 /SPForms_Profile2010.js
var SPForms;
(function (SPForms) {
    var Profile;
    (function (Profile) {
        var ProfileManager2010 = (function () {
            function ProfileManager2010() {
            }
            ProfileManager2010.getProfileAsync = function () {
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
            return ProfileManager2010;
        })();
        Profile.ProfileManager2010 = ProfileManager2010;
    })(Profile = SPForms.Profile || (SPForms.Profile = {}));
})(SPForms || (SPForms = {}));
//# sourceMappingURL=SPForms_Profile2010.js.map
