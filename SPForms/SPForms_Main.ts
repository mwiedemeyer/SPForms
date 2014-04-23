/// <reference path="SPForms_Profile.ts" />
/// <reference path="SPForms_Fields.ts" />
/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="Scripts/typings/jqueryui/jqueryui.d.ts" />
/// <reference path="Scripts/typings/sharepoint/SharePoint.d.ts" />

module SPForms {

    interface IQueryStringParameter {
        key: string;
        value: string;
    }

    interface IFormSettings {
        maxParticipants: number;
    }

    export class FormManager {
        private settings: IFormSettings;
        private form: JQuery;
        private fields: FormFields.IFormField[] = [];

        public static init(formId: string): FormManager {
            var f = new FormManager(formId);
            f.initialize();
            return f;
        }

        constructor(formId: string) {
            this.form = $("#" + formId);
        }

        private initialize(): void {
            this.settings = JSON.parse(this.form.attr("data-form-settings"));

            this.initJQueryUIDefaults();

            // initialize all form fields
            this.form.find("[data-form-field]").each((i, f) => {
                var field = FormFields.FormField.getFormFieldByType($(f));
                this.fields.push(field);
            });

            this.wireUpEvents();
            this.populateFieldsFromQueryString();
            this.loadProfileData();
        }

        // Attach events to controls
        private wireUpEvents(): void {
            // wire up submit button
            this.form.find("[data-form-submit]").click((el) => {
                var button = $(el.target);
                var listName = button.attr("data-form-submit-list");

                // remove 'invalid' css from all elements and remove tooltips
                $("[data-form-field]").removeClass("form-invalid");
                $("[data-form-field]").tooltip(); //init if not yet initalized
                $("[data-form-field]").tooltip("option", "disabled", true);

                if (!this.validateControls()) {
                    return;
                }

                this.createListItem(listName)
                    .done(() => {
                        var onSuccessFunction = button.attr("data-form-submit-onsuccess");
                        if (onSuccessFunction !== undefined) {
                            window[onSuccessFunction]();
                        }
                    })
                    .fail((message) => {
                        var onFailedFunction = button.attr("data-form-submit-onfailed");
                        if (onFailedFunction !== undefined) {
                            window[onFailedFunction](message);
                        }
                    });
            });
        }

        // Set field values if defined in QueryString
        private populateFieldsFromQueryString(): void {
            var par = Helper.getParameters();
            if (par === null)
                return;
            // check if parameter begins with "form-" and set the fields value
            par.forEach((p) => {
                if (p.key.indexOf("form-") > -1) {
                    var fieldName = p.key.substring(5);
                    if ($("[data-form-field=" + fieldName + "]").length > 0)
                        $("[data-form-field=" + fieldName + "]").val(decodeURIComponent(p.value));
                }
            });
        }

        // load profile data if at least one field requires profile information
        private loadProfileData(): void {
            var isAtLeastOneProfileFieldDefined: boolean = false;
            this.fields.forEach((field) => {
                if (field.get_isProfileField()) {
                    isAtLeastOneProfileFieldDefined = true;
                }
            });

            if (!isAtLeastOneProfileFieldDefined)
                return;

            Profile.ProfileManager.getProfileAsync()
                .done((data) => {
                    this.fields.forEach((field) => {
                        var profileProperty = field.get_profileProperty();
                        switch (profileProperty) {
                            case FormFields.ProfileProperty.DisplayName:
                                field.set_value(data.displayName);
                                break;
                            case FormFields.ProfileProperty.FirstName:
                                field.set_value(data.firstName);
                                break;
                            case FormFields.ProfileProperty.LastName:
                                field.set_value(data.lastName);
                                break;
                            case FormFields.ProfileProperty.Phone:
                                field.set_value(data.phone);
                                break;
                            case FormFields.ProfileProperty.Department:
                                field.set_value(data.department);
                                break;
                            case FormFields.ProfileProperty.Title:
                                field.set_value(data.title);
                                break;
                            case FormFields.ProfileProperty.EMail:
                                field.set_value(data.email);
                                break;
                            case FormFields.ProfileProperty.Company:
                                field.set_value(data.company);
                                break;
                            case FormFields.ProfileProperty.Unknown:
                            default:
                                break;
                        }
                    });
                });
        }

        // Validate all field controls
        private validateControls(): boolean {
            var isValid: boolean = true;

            this.fields.forEach((f) => {
                if (!f.validate()) {
                    isValid = false;
                    return;
                }
            });

            return isValid;
        }

        // Create SharePoint list item from fields
        private createListItem(listName: string): JQueryPromise<void> {

            var deferred = $.Deferred<void>();

            var context = new SP.ClientContext();
            var web = context.get_web();
            var list = web.get_lists().getByTitle(listName);

            // check for max participants before adding the new item
            if (this.settings.maxParticipants === undefined || this.settings.maxParticipants < 1) {
                this.createListItemInternal(deferred, context, list);
            }
            else {
                context.load(list, 'ItemCount');
                context.executeQueryAsync(
                    () => {
                        if (list.get_itemCount() >= this.settings.maxParticipants) {
                            deferred.reject("Error: MaxParticipants");
                            return;
                        }

                        this.createListItemInternal(deferred, context, list);
                    },
                    (sender, args) => {
                        deferred.reject(args.get_message());
                    });
            }

            return deferred.promise();
        }

        private createListItemInternal(deferred: JQueryDeferred<any>, context: SP.ClientContext, list: SP.List) {
            var lc = new SP.ListItemCreationInformation();
            var listItem = list.addItem(lc);

            this.fields.forEach((field) => {
                var fieldName = field.get_name();
                var content = field.get_value();

                listItem.set_item(fieldName, content);
            });

            listItem.update();
            context.executeQueryAsync(
                () => {
                    deferred.resolve();
                },
                (sender, args) => {
                    deferred.reject(args.get_message());
                });
        }

        private initJQueryUIDefaults() {
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
        }
    }

    class Helper {
        static getParameters(): IQueryStringParameter[] {
            var par: IQueryStringParameter[] = [];

            var query = window.location.search.substring(1);
            if (query === "")
                return null;

            var vars = query.split("&");
            for (var i = 0; i < vars.length; i++) {
                var pair = vars[i].split("=");
                var p: IQueryStringParameter = {
                    key: pair[0],
                    value: pair[1]
                };
                par.push(p);
            }

            return par;
        }
    }
}

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