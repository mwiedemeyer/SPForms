/// <reference path="SPForms_PeoplePicker2010.ts" />
/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="Scripts/typings/jqueryui/jqueryui.d.ts" />
/// <reference path="Scripts/typings/sharepoint/SharePoint.d.ts" />

module SPForms.FormFields {

    export interface IFormField {
        internalField: JQuery;
        get_name(): string;
        get_type(): FormFieldType;
        get_value(): string;
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
        PeoplePicker
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

        static getFormFieldByType(internalField: JQuery): FormField {
            switch (FormField.get_type(internalField)) {
                case FormFieldType.Radio:
                    return new RadioFormField(internalField);
                case FormFieldType.PeoplePicker:
                    return new PeopleFormField(internalField);
                case FormFieldType.DatePicker:
                    return new DatePickerField(internalField);
                case FormFieldType.Text:
                default:
                    return new FormField(internalField);
            }
        }

        static get_type(internalField: JQuery): FormFieldType {
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
            return FormField.get_type(this.internalField);
        }

        get_value(): string {
            return this.internalField.val();
        }

        set_value(val: string) {
            this.internalField.val(val);
        }

        get_isrequired(): boolean {
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
        }
    }

    export class RadioFormField extends FormField {
        get_value(): string {
            var groupName = this.internalField.attr("name");
            return $("[name=" + groupName + "]:checked").val();
        }
    }

    export class PeopleFormField extends FormField {

        private peoplePicker: PeoplePicker2010;

        constructor(internalField: JQuery) {
            super(internalField);

            var ppMode = internalField.attr("data-form-peoplepicker");
            if (ppMode === "2010") {

                this.internalField.prop("disabled", "disabled");

                this.peoplePicker = new PeoplePicker2010(this.internalField.attr("id"));
                var button = $('<img src="/Scripts/images/addressbook.gif" style="margin-left: 5px; vertical-align: bottom; cursor: pointer;" />');
                button.click(() => {
                    this.peoplePicker.openPeoplePicker();
                });

                this.internalField.after(button);
            }
            else if (ppMode === "2013") {

            }
        }

        get_value(): string {
            switch (this.internalField.attr("data-form-field-value")) {
                case "displayname":
                    return this.internalField.attr("data-people-display");
                case "email":
                    return this.internalField.attr("data-people-email");
                case "accountname":
                default:
                    return this.internalField.attr("data-people-account");
            }
        }
    }

    export class DatePickerField extends FormField {

        constructor(internalField: JQuery) {
            super(internalField);

            this.internalField.datepicker();
        }
    }
}