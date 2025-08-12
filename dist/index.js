// SGNL Job Script - Auto-generated bundle
'use strict';

/**
 * Azure AD Enable User Action
 *
 * Enables a user account in Azure Active Directory by setting accountEnabled to true.
 * This allows the user to sign in and access resources.
 */

/**
 * Helper function to enable a user account
 * @param {string} userPrincipalName - The user principal name
 * @param {string} tenantUrl - Azure AD tenant URL
 * @param {string} authToken - Azure AD access token
 * @returns {Promise<Object>} API response
 */
async function enableUserAccount(userPrincipalName, tenantUrl, authToken) {
  // URL encode the user principal name to prevent injection
  const encodedUpn = encodeURIComponent(userPrincipalName);
  const url = new URL(`${tenantUrl}/users/${encodedUpn}`);

  // Ensure token has proper Bearer prefix
  const authHeader = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;

  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accountEnabled: true
    })
  });

  return response;
}

var script = {
  /**
   * Main execution handler - enables the specified user account
   * @param {Object} params - Job input parameters
   * @param {Object} context - Execution context with env, secrets, outputs
   * @returns {Object} Job results
   */
  invoke: async (params, context) => {
    // Validate required parameters
    if (!params.userPrincipalName) {
      throw new Error('userPrincipalName is required');
    }

    // Get configuration
    const tenantUrl = context.environment?.AZURE_AD_TENANT_URL || 'https://graph.microsoft.com/v1.0';
    const authToken = context.secrets?.AZURE_AD_TOKEN;

    if (!authToken) {
      throw new Error('AZURE_AD_TOKEN secret is required');
    }

    console.log(`Enabling user account: ${params.userPrincipalName}`);

    // Call Azure AD API to enable the account
    const response = await enableUserAccount(
      params.userPrincipalName,
      tenantUrl,
      authToken
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

    console.log(`Successfully enabled user account: ${params.userPrincipalName}`);

    return {
      status: 'success',
      userPrincipalName: params.userPrincipalName,
      accountEnabled: accountEnabled
    };
  },

  /**
   * Error recovery handler - handles retryable errors
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   * @returns {Object} Recovery results
   */
  error: async (params, _context) => {
    const { error } = params;

    // Check for rate limiting (429) or temporary server errors (502, 503, 504)
    if (error.message.includes('429') ||
        error.message.includes('502') ||
        error.message.includes('503') ||
        error.message.includes('504')) {
      console.log('Retryable error detected, requesting retry...');
      return { status: 'retry_requested' };
    }

    // Fatal errors (401, 403) should not retry
    if (error.message.includes('401') || error.message.includes('403')) {
      throw new Error(error.message); // Re-throw to mark as fatal
    }

    // Default: let framework retry
    return { status: 'retry_requested' };
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

module.exports = script;
