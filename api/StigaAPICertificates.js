// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

const certificates = {
    // Client certificate
    clientCert: `-----BEGIN CERTIFICATE-----
MIID3jCCAsYCCQDX19TYX4KbzTANBgkqhkiG9w0BAQsFADCBuzELMAkGA1UEBhMC
SVQxEDAOBgNVBAgMB1RyZXZpc28xHDAaBgNVBAcME0Nhc3RlbGZyYW5jbyBWZW5l
dG8xEjAQBgNVBAoMCVN0aWdhIFNQQTEVMBMGA1UECwwMQ29ubmVjdGl2aXR5MSQw
IgYDVQQDDBtyb2JvdC1tcXR0LWJyb2tlci5zdGlnYS5jb20xKzApBgkqhkiG9w0B
CQEWHGRpZ2l0YWwuaW5ub3ZhdGlvbkBzdGlnYS5jb20wIBcNMjExMjMwMDkyNTI3
WhgPMjE1ODExMjIwOTI1MjdaMIGjMQswCQYDVQQGEwJJVDEKMAgGA1UECAwBLjEK
MAgGA1UEBwwBLjESMBAGA1UECgwJU3RpZ2EgU1BBMRUwEwYDVQQLDAxDb25uZWN0
aXZpdHkxJDAiBgNVBAMMG3JvYm90LW1xdHQtYnJva2VyLnN0aWdhLmNvbTErMCkG
CSqGSIb3DQEJARYcZGlnaXRhbC5pbm5vdmF0aW9uQHN0aWdhLmNvbTCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBAKTfTuUMJBfsweC71o1s9NQl4/C7oYvr
33Nl2ogSQLI9PALqfvYU0uzoh/rktE8iJ9WM5LUCvmj+IOSQgwkhXnKymU9Mk5vy
TAbvh0XoVliF8+ERmxJb/03roNDJigUZUoBpDr6TftYSwab33SKtDetKkj/A4sHL
quro6nB6TCc3RZB6UVO/V2lN2FEvMAdSsrvgUfiDzoK30LRsyquDYdp1SGBch9cV
lyCUt55f8xjAZaRz2xEvxDfcjd17nnjEsL3eEcLv0h3wrC47g/JR4TCvfYp3q8+i
6/LPMb3KaTxRrjppx0CaWHI0N9TBNui5yV2GTh3RZdj+21VdSBqPnSMCAwEAATAN
BgkqhkiG9w0BAQsFAAOCAQEAknr/p4OjP/17tyVnfmwsIGH2VrxsIQdL56U07bfM
xmy/b/GydRJ0j/2i/paqgDd1mVokI9wpp/9lTx/wHNEkoZNvkxy9wwPGZvoeAuu9
JqILkjeiuTZZzA1wvdh8pPhB6DIJwuNC/b6d0FmCkSm8YD2AeTMeGjrub2j8h5Ez
uuOi7ONHqZ6+aW7fNVur1gtZ+M3I1DkjeEvTHXqNJ9EpX+Nx9+Dq9S+UPCTdT8gD
1KQdpiXB41jw3PSKZVqu+fODQnlMxAVvKFGUAmsx23sx/Wvdz4nVOv+ym2ONUWSz
mCsd99Oz3icQI5EHEcGJJ/PwYHMxjK7o5g7VnC/8xJVgnA==
-----END CERTIFICATE-----`,
    // Client private key
    clientKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEApN9O5QwkF+zB4LvWjWz01CXj8Luhi+vfc2XaiBJAsj08Aup+
9hTS7OiH+uS0TyIn1YzktQK+aP4g5JCDCSFecrKZT0yTm/JMBu+HRehWWIXz4RGb
Elv/Teug0MmKBRlSgGkOvpN+1hLBpvfdIq0N60qSP8Diwcuq6ujqcHpMJzdFkHpR
U79XaU3YUS8wB1Kyu+BR+IPOgrfQtGzKq4Nh2nVIYFyH1xWXIJS3nl/zGMBlpHPb
ES/EN9yN3XueeMSwvd4Rwu/SHfCsLjuD8lHhMK99inerz6Lr8s8xvcppPFGuOmnH
QJpYcjQ31ME26LnJXYZOHdFl2P7bVV1IGo+dIwIDAQABAoIBAHeHcfI6uBwkSHb+
l1DW8jSv9646yabgbZKDAEjwOrk+Dbjrevo7JKQe/R6XGmXYlFqNF+5nO9ZwjzZF
0soWyBuNgfpswQMpSZcppr+27oqlKqc8lVldGx3Ju0BDLO3/asGv6MGfuy/GT2EW
h9qw7ctst9TCqWLonlRKYlUDRRyUGjAEN10OgRk1RaDiWJF0EY/+1jEtyiKdnzd0
nv9L86PXnGg4z9wBkiHexeD0PShjHCWBAWDtQvkJeCpaLAoZ2Nd+JdcuEDkK3Thx
ynHTWCsuFWTQAWo/cbVJ/pQHUBCTZXGAe9RuPzzFqyAThiFElr0vn0Ml5655qtL2
XsfeiVECgYEA23O7HNQ9WF/A0dIU6srWbwafco3FuE0mraPhkZo/n4EMqow/y40U
gXXQ7Kp2R4/9uFU/hp409MwquSBlNzTAnN5KM/fiyHNiuxTywJSl2tsaNX5a32+T
1Lb+CDGl6RtZpjIZBi17WdT3GOKAE/D/3BFDyh0Nw99uvI5XD0vztckCgYEAwFSW
AEErWzuf/JOLeasAKEAcW3Q5upbrKnvFctaHxxH75snR6tTjbEbZq16rghNZYF7v
wegd5Fy60+/QTwzwvuygnNKqKREhdrryGQgiG7CD2SFqHAkSCcliB7dP0yyzkkR9
L+7obT2R6DB/nV4zv+OYk2MP249LKFk4oiblIYsCgYBuduIAEAHVI1XvCD3JNlMc
Tgwi4KRfMk6+5xhbb3aJNq+GhdRzBNAGnqSNDP0+5odDq32vqKFlfAQhbeIlGOO/
0tEtOaEpX5OaMmBDek/GS7X0qWbaw9J5J6fVvhASt9a3ps4b4vcNb/r1xsXLw+s2
/mXOLjPIngai2U+Pfp7tqQKBgB0GJsTPEN3pt5EEKw4nUhTA6AadGYEg+Ugl+XwF
B+RwwFTpq/YGPnO+lWaZGMS+asRyTzgx8SDfJYqKLCNhzorhZrODzw33eddTCung
IlWPY7ZGpp6od8JmU5bagP9bRZYTI9kx8n1Zx0UE3J1A9ApHLGVBk8kMbMkf/b3q
pLVVAoGAXbpuE8d+KRXCq52lWNBFMzmV2eYF2Td7JsY2WRAvPRCS/WeexVhOqxW6
v//2ZWhw8nfbPF+nA5ruwTj3Cy+Zv170CmQQdNSNXFsHM7dvMGlJOy4OSF9fVUBa
18JVKOJs/gLmrtCW73SZMAPjfPvkaFIn6+mwmXimqnIULJaHugQ=
-----END RSA PRIVATE KEY-----`,
};

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

function getCertificates() {
    return {
        cert: certificates.clientCert,
        key: certificates.clientKey,
    };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = {
    getCertificates,
};

// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
