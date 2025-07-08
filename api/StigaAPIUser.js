// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const { formatStruct } = require('./StigaAPIUtilitiesFormat');
const StigaAPIComponent = require('./StigaAPIComponent');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

class StigaAPIUser extends StigaAPIComponent {
    constructor(serverConnection, options = {}) {
        super(options);
        this.server = serverConnection;
        this.userData = undefined;
    }

    async load() {
        try {
            const response = await this.server.get('/api/user');
            if (response.ok) {
                const { data } = await response.json();
                this.userData = data;
                return true;
            }
        } catch (e) {
            this.display.error('user: failed to load:', e);
        }
        return false;
    }

    getUuid() {
        return this.userData?.attributes?.uuid || undefined;
    }

    getFullName() {
        if (!this.userData?.attributes) return undefined;
        const { firstname, lastname } = this.userData.attributes;
        return `${firstname || ''} ${lastname || ''}`.trim();
    }

    getEmail() {
        return this.userData?.attributes?.email || undefined;
    }

    getMobile() {
        return this.userData?.attributes?.mobile || undefined;
    }

    getCountry() {
        return this.userData?.attributes?.country_uuid || undefined;
    }

    getLanguage() {
        return this.userData?.attributes?.language || undefined;
    }

    getLastLogin() {
        return this.userData?.attributes?.last_login ? new Date(this.userData.attributes.last_login) : undefined;
    }

    isVerified() {
        return this.userData?.attributes?.is_verified || false;
    }

    hasAcceptedTerms() {
        return this.userData?.attributes?.terms_and_conditions || false;
    }

    hasMarketingConsent() {
        return this.userData?.attributes?.terms_marketing || false;
    }

    hasDataAnalysisConsent() {
        return this.userData?.attributes?.data_analysis_consent || false;
    }

    toString() {
        return formatStruct({ name: this.getFullName(), email: this.getEmail(), verified: this.isVerified() ? 'true' : 'false' }, 'user');
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = StigaAPIUser;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
