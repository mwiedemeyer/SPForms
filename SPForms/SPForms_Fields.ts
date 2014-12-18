module SPForms.FormFields {

    export interface IFormField {
        internalField: JQuery;
        get_name(): string;
        get_type(): FormFieldType;
        get_value(): any;
        set_value(val: string): void;
        get_isrequired(): boolean;
        get_isProfileField(): boolean;
        get_profileProperty(): ProfileProperty;
        validate(): boolean;
    }

    export enum FormFieldType {
        Text,
        Radio,
        DatePicker,
        PeoplePicker,
        DropDown
    }

    export enum ProfileProperty {
        Unknown,
        DisplayName,
        FirstName,
        LastName,
        EMail,
        Company,
        Department,
        Phone,
        Title
    }

    export class FormField implements IFormField {

        internalField: JQuery;

        //#region static methods to get field by type

        public static getFormField(internalField: JQuery): FormField {
            switch (FormField.getFormFieldType(internalField)) {
                case FormFieldType.Radio:
                    return new RadioFormField(internalField);
                case FormFieldType.PeoplePicker:
                    return new PeopleFormField(internalField);
                case FormFieldType.DatePicker:
                    return new DatePickerField(internalField);
                case FormFieldType.DropDown:
                    return new DropDownField(internalField);
                case FormFieldType.Text:
                default:
                    return new FormField(internalField);
            }
        }

        public static getFormFieldType(internalField: JQuery): FormFieldType {

            if (internalField.get()[0].tagName.toLowerCase() === "select") {
                return FormFieldType.DropDown;
            }

            var type = internalField.attr("type");
            switch (type) {
                case "radio":
                    return FormFieldType.Radio;
                case "text":
                default:
                    if (internalField.attr("data-form-peoplepicker") !== undefined)
                        return FormFieldType.PeoplePicker;
                    if (internalField.attr("data-form-datepicker") !== undefined)
                        return FormFieldType.DatePicker;
                    return FormFieldType.Text;
            }
        }

        //#endregion

        constructor(internalField: JQuery) {
            this.internalField = internalField;
            if (this.get_isrequired()) {
                var label = $("label[for=" + this.internalField.attr("id") + "]");
                if (label.length > 0)
                    label.append('<span style="color: red;"> *</span>');
            }
        }

        //#region Properties

        get_name(): string {
            return this.internalField.attr("data-form-field");
        }

        get_type(): FormFieldType {
            return FormField.getFormFieldType(this.internalField);
        }

        get_value(): any {
            return this.internalField.val();
        }

        set_value(val: string) {
            this.internalField.val(val);
        }

        get_isrequired(): boolean {
            if (!this.internalField.is(":visible"))
                return false;
            return (this.internalField.attr("data-form-required") !== undefined);
        }

        get_validatorExpression(): string {
            return this.internalField.attr("data-form-validate");
        }

        get_isProfileField(): boolean {
            return (this.internalField.attr("data-form-profile") !== undefined);
        }

        get_profileProperty(): ProfileProperty {
            try {
                return ProfileProperty[this.internalField.attr("data-form-profile")];
            } catch (e) {
                return ProfileProperty.Unknown;
            }
        }

        //#endregion

        validate(): boolean {
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
        }
    }

    export class RadioFormField extends FormField {
        get_value(): any {
            var groupName = this.internalField.attr("name");
            return $("[name=" + groupName + "]:checked").val();
        }
    }

    export class PeopleFormField extends FormField {

        private peoplePickerMode: number;
        private peoplePicker2010: PeoplePicker2010;
        private peoplePicker2013: PeoplePicker2013;

        constructor(internalField: JQuery) {
            super(internalField);

            this.peoplePickerMode = Helper.getSPVersion();
            if (this.peoplePickerMode === 2010) {

                this.internalField.prop("disabled", "disabled");

                this.peoplePicker2010 = new PeoplePicker2010(this.internalField.attr("id"));
                var button = $('<img src="/Scripts/images/addressbook.gif" style="margin-left: 5px; vertical-align: bottom; cursor: pointer;" />');
                button.click(() => {
                    this.peoplePicker2010.openPeoplePicker();
                });

                this.internalField.after(button);
            }
            else if (this.peoplePickerMode === 2013) {

                var origId = this.internalField.attr("id");
                var divId = origId + "_div";

                this.internalField.hide();

                var div = $('<div id="' + divId + '"></div>');
                this.internalField.after(div);

                this.peoplePicker2013 = new PeoplePicker2013(divId);
                this.peoplePicker2013.initAsync();
            }
        }

        get_value(): any {

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
        }
    }

    export class DatePickerField extends FormField {

        constructor(internalField: JQuery) {
            super(internalField);

            this.internalField.datepicker();
        }
    }

    export class DropDownField extends FormField {

        private _list: string;
        private _valueColumn: string;
        private _isLookup: boolean;
        private _spValueCache: ISPCacheItem[];
        private _valuesToElementItems: IKeyValue[];
        private _spFilterField: string;
        private _initialOptionElements: JQuery;

        constructor(internalField: JQuery) {
            super(internalField);

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

        private loadList(): JQueryPromise<void> {

            var deferred = $.Deferred<void>();

            var context = new SP.ClientContext();
            var web = context.get_web();
            var list = web.get_lists().getByTitle(this._list);
            var items = list.getItems(SP.CamlQuery.createAllItemsQuery());

            this._spValueCache = [];
            $("option", this.internalField).remove();
            this._initialOptionElements.appendTo(this.internalField);

            context.load(items);
            context.executeQueryAsync(() => {

                for (var i = 0; i < items.get_count(); i++) {
                    var item = items.get_item(i);
                    var val = item.get_item(this._valueColumn);

                    if (this._spFilterField === undefined || this._spFilterField === null || this._spFilterField === "") {
                        this.internalField.append('<option value="' + val + '">' + val + '</option>');
                    }
                    else {
                        var filterValue = item.get_item(this._spFilterField);
                        this.internalField.append('<option value="' + val + '" data-form-filtervalue="' + filterValue + '">' + val + '</option>');
                    }

                    var cacheItem: ISPCacheItem = {
                        key: val,
                        spItems: []
                    };

                    this._valuesToElementItems.forEach((field) => {
                        var spItem: IKeyValue = {
                            key: field.key,
                            value: item.get_item(field.value)
                        };
                        cacheItem.spItems.push(spItem);
                    });

                    this._spValueCache.push(cacheItem);                    
                }
                deferred.resolve();
            }, (sender, args) => {
                    this.internalField.append('<option value="">ERROR: ' + args.get_message() + '</option>');
                    deferred.reject(args.get_message());
                });

            return deferred.promise();
        }

        private wireupEvents(): void {
            this.internalField.change(() => {
                var val = $("option:selected", this.internalField).val();

                this._spValueCache.forEach((cacheItem) => {
                    if (cacheItem.key === val) {
                        cacheItem.spItems.forEach((spItem) => {
                            $("#" + spItem.key).text(spItem.value);
                        });
                    }
                });
            });
        }

        private setupDependencies(): void {
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
                _that.loadList().done(() => {
                    $("option[data-form-filtervalue]option[data-form-filtervalue!='" + $(this).val() + "']", _that.internalField).remove();
                });
            });
        }

        private parseValuesToElements(valuesToElementsString: string): void {

            // Format: HtmlElementId=SPListFieldName,HtmlElementId2,SPListFieldName2,...

            if (valuesToElementsString === undefined || valuesToElementsString === null || valuesToElementsString === "") {
                return;
            }

            var split = valuesToElementsString.split(",");
            for (var i = 0; i < split.length; i++) {
                var parts = split[i].split("=");

                var vitem: IKeyValue = {
                    key: parts[0],
                    value: parts[1]
                };

                this._valuesToElementItems.push(vitem);
            }
        }
    }

    interface ISPCacheItem {
        key: string;
        spItems: IKeyValue[];
    }

    interface IKeyValue {
        key: string;
        value: string;
    }
}