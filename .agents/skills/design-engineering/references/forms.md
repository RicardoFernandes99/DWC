# Forms

Use a real form with a submit button; other actions use `type="button"`. Associate
visible labels, descriptions and error IDs. Use appropriate input types and
autocomplete, preserving password-manager behavior for authentication.

For nontrivial forms use TanStack Form when introduced, sharing field wrappers
rather than building a generic form engine. Client validation helps the user;
server validation remains authoritative. Put errors beside inputs, identify them
with text, and focus the first invalid field after a rejected submit.

Prevent duplicate submits using actual pending state. Restore controls after
failure and preserve entered data. Delay only cosmetic spinners, not behavioral
flags. In dialogs keep long form content scrollable and footer actions reachable;
a submit button outside the form can use its form ID.

Never report checkout or bid success before the API accepts it. Confirm irreversible
user actions or offer undo when the feature supports it, proportional to the action.
