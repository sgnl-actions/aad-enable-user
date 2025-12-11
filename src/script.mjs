/**
 * Azure AD Enable User Action
 *
 * Enables a user account in Azure Active Directory by setting accountEnabled to true.
 * This allows the user to sign in and access resources.
 */

import { getBaseURL, createAuthHeaders, resolveJSONPathTemplates} from '@sgnl-actions/utils';

/**
 * Helper function to enable a user account
 * @param {string} userPrincipalName - The user principal name
 * @param {string} baseUrl - Azure AD base URL
 * @param {Object} headers - Request headers with Authorization
 * @returns {Promise<Object>} API response
 */
async function enableUserAccount(userPrincipalName, baseUrl, headers) {
  // URL encode the user principal name to prevent injection
  const encodedUpn = encodeURIComponent(userPrincipalName);
  const url = `${baseUrl}/v1.0/users/${encodedUpn}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      accountEnabled: true
    })
  });

  return response;
}

export default {
  /**
   * Main execution handler - enables the specified user account
   * @param {Object} params - Job input parameters
   * @param {string} params.userPrincipalName - User Principal Name (email) to enable
   * @param {string} params.address - The Azure AD API base URL (e.g., https://graph.microsoft.com)
   * @param {Object} context - Execution context with env, secrets, outputs
   * @param {string} context.environment.ADDRESS - Default Azure AD API base URL
   *
   * The configured auth type will determine which of the following environment variables and secrets are available
   * @param {string} context.secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_AUDIENCE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_SCOPE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL
   *
   * @param {string} context.secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN
   *
   * @returns {Object} Job results
   */
  invoke: async (params, context) => {
    const jobContext = context.data || {};

    // Resolve JSONPath templates in params
    const { result: resolvedParams, errors } = resolveJSONPathTemplates(params, jobContext);
    if (errors.length > 0) {
      console.warn('Template resolution errors:', errors);
    }

    // Get base URL and authentication headers using utilities
    const baseUrl = getBaseURL(resolvedParams, context);
    const headers = await createAuthHeaders(context);

    console.log(`Enabling user account: ${resolvedParams.userPrincipalName}`);

    // Call Azure AD API to enable the account
    const response = await enableUserAccount(
      resolvedParams.userPrincipalName,
      baseUrl,
      headers
    );

    // Check response status
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to enable user: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }

    // For PATCH operations, a 204 No Content is success
    let accountEnabled = true;
    if (response.status !== 204) {
      // If there's a response body, parse it
      const result = await response.json();
      accountEnabled = result.accountEnabled ?? true;
    }

    console.log(`Successfully enabled user account: ${resolvedParams.userPrincipalName}`);

    return {
      status: 'success',
      userPrincipalName: resolvedParams.userPrincipalName,
      accountEnabled: accountEnabled,
      address: baseUrl
    };
  },

  /**
   * Error recovery handler - framework handles retries by default
   * Only implement if custom recovery logic is needed
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   * @returns {Object} Recovery results
   */
  error: async (params, _context) => {
    const { error, userPrincipalName } = params;
    console.error(`User enable failed for ${userPrincipalName}: ${error.message}`);

    // Framework handles retries for transient errors (429, 502, 503, 504)
    // Just re-throw the error to let the framework handle it
    throw error;
  },

  /**
   * Graceful shutdown handler - cleanup on halt
   * @param {Object} params - Original params plus halt reason
   * @param {Object} context - Execution context
   * @returns {Object} Cleanup results
   */
  halt: async (params, _context) => {
    const { reason } = params;
    console.log(`User enable operation halted: ${reason}`);

    return {
      status: 'halted',
      userPrincipalName: params.userPrincipalName || 'unknown',
      reason: reason
    };
  }
};