// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const StigaAPIComponent = require('./StigaAPIComponent');

const API_KEY_DEFAULT = 'AIzaSyCPtRBU_hwWZYsguHp9ucGrfNac0kXR6ug';

const URL_DEFAULT = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword';

const TOKEN_EXPIRY_GRACE_PERIOD = 5 * 60 * 1000;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class StigaAPIAuthentication extends StigaAPIComponent {
    constructor(email, password, apiKey = API_KEY_DEFAULT, url = URL_DEFAULT, options = {}) {
        super(options);
        this.email = email;
        this.password = password;
        this.apiKey = apiKey;
        this.url = url;
        this.token = undefined;
        this.tokenExpiry = undefined;
        this.tokenRefresh = undefined;
    }

    async isValid() {
        try {
            await this._ensureValidToken();
            return true;
        } catch {
            return false;
        }
    }

    async addAuthentication(request) {
        await this._ensureValidToken();
        if (!request.headers) request.headers = {};
        request.headers.Authorization = `Bearer ${this.token}`;
        return request;
    }

    async _ensureValidToken() {
        if (!this.tokenIsValid()) await this._authenticate();
    }

    async _authenticate() {
        const payload = {
            email: this.email,
            password: this.password,
            returnSecureToken: true,
        };
        const params = new URL(this.url);
        params.searchParams.append('key', this.apiKey);
        try {
            const response = await fetch(params.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (response.ok) {
                this.token = data.idToken;
                this.tokenRefresh = data.tokenRefresh;
                // Firebase tokens typically expire in 1 hour (3600 seconds)
                const expiresIn = Number.parseInt(data.expiresIn) || 3600;
                this.tokenExpiry = Date.now() + expiresIn * 1000;
            } else {
                this.display.error(`auth: authentication failed, status: ${response.status} - ${JSON.stringify(data)}`);
                throw new Error('Authentication failed');
            }
        } catch (e) {
            this.display.error(`auth: authentication failed, error:`, e);
            throw e;
        }
    }

    async tokenRefreshNow() {
        this.token = undefined;
        this.tokenExpiry = undefined;
        await this._ensureValidToken();
    }

    tokenIsValid() {
        const graceTime = Date.now() + TOKEN_EXPIRY_GRACE_PERIOD;
        return this.token && this.tokenExpiry && this.tokenExpiry > graceTime;
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = StigaAPIAuthentication;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
