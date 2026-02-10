package middleware

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"strings"
	"unicode"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

type contextKey string

const userIDKey contextKey = "userID"

// UserIDFromContext retrieves the authenticated user ID from the request context.
func UserIDFromContext(ctx context.Context) string {
	uid, _ := ctx.Value(userIDKey).(string)
	return uid
}

// WithUserID returns a new context with the given user ID set.
// Useful for testing handlers that depend on auth middleware.
func WithUserID(ctx context.Context, uid string) context.Context {
	return context.WithValue(ctx, userIDKey, uid)
}

// InternalOrFirebaseAuth returns middleware that first checks for an internal
// service-to-service token (X-Internal-Auth header + X-User-ID), falling back
// to Firebase ID token verification. The internal path is used by the Next.js
// proxy routes that have already validated the user session.
func InternalOrFirebaseAuth(authService *service.AuthService, secret string) func(http.Handler) http.Handler {
	secretBytes := []byte(secret)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			internalToken := r.Header.Get("X-Internal-Auth")
			userID := r.Header.Get("X-User-ID")

			if internalToken != "" && userID != "" && len(secretBytes) > 0 {
				if subtle.ConstantTimeCompare([]byte(internalToken), secretBytes) == 1 {
					userID = strings.TrimSpace(userID)
					if userID == "" || len(userID) > 256 || !isPrintableASCII(userID) {
						respondError(w, http.StatusBadRequest, "invalid user ID")
						return
					}
					ctx := context.WithValue(r.Context(), userIDKey, userID)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
				respondError(w, http.StatusUnauthorized, "invalid internal auth token")
				return
			}

			// Fall back to Firebase auth
			token := extractBearerToken(r)
			if token == "" {
				respondError(w, http.StatusUnauthorized, "missing authorization token")
				return
			}

			uid, err := authService.VerifyToken(r.Context(), token)
			if err != nil {
				respondError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), userIDKey, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// FirebaseAuth returns middleware that verifies Firebase ID tokens.
// Requests without a valid token receive a 401 JSON response.
func FirebaseAuth(authService *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractBearerToken(r)
			if token == "" {
				respondError(w, http.StatusUnauthorized, "missing authorization token")
				return
			}

			uid, err := authService.VerifyToken(r.Context(), token)
			if err != nil {
				respondError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), userIDKey, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return ""
	}
	parts := strings.SplitN(auth, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}

// isPrintableASCII checks that every rune is a printable ASCII character.
func isPrintableASCII(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII || !unicode.IsPrint(r) {
			return false
		}
	}
	return true
}

func respondError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   message,
	})
}
