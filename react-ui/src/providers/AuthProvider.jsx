/**
 * Authentication state provider.
 */

import { useReducer, useCallback, useEffect } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { localStorage } from '../utils/storage';
import { AUTH_ACTIONS, initialState } from '../constants/authConstants';
import { authReducer } from '../reducers/authReducer';
import { authApi } from '../api/auth';

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const storedUser = localStorage.get('user');
      const storedToken = localStorage.get('token');

      if (!storedUser || !storedToken) {
        if (mounted) {
          dispatch({
            type: AUTH_ACTIONS.LOGIN_FAILURE,
            payload: null,
          });
        }
        return;
      }

      try {
        const currentUser = await authApi.getCurrentUser();
        if (!mounted) return;

        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user: currentUser,
            token: storedToken,
          },
        });
      } catch {
        localStorage.remove('user');
        localStorage.remove('token');
        if (mounted) {
          dispatch({
            type: AUTH_ACTIONS.LOGIN_FAILURE,
            payload: null,
          });
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (credentials, loginApi) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const apiResponse = await loginApi(credentials);
      const response = {
        user: apiResponse.user,
        token: apiResponse.access_token,
      };

      localStorage.set('user', response.user);
      localStorage.set('token', response.token);

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: {
          user: response.user,
          token: response.token,
        },
      });

      return response;
    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: error.message || 'Login failed',
      });
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.remove('user');
    localStorage.remove('token');
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  }, []);

  const updateUser = useCallback((updates) => {
    const updatedUser = { ...state.user, ...updates };
    localStorage.set('user', updatedUser);
    dispatch({
      type: AUTH_ACTIONS.UPDATE_USER,
      payload: updates,
    });
  }, [state.user]);

  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  const value = {
    ...state,
    login,
    logout,
    updateUser,
    clearError,
    isAuthenticated: state.isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
