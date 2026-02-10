package service

import (
	"context"
	"fmt"

	"firebase.google.com/go/v4/auth"
)

// AuthService verifies Firebase ID tokens.
type AuthService struct {
	client AuthClient
}

// AuthClient is the interface for Firebase token verification.
// Using an interface allows testing with mocks.
type AuthClient interface {
	VerifyIDToken(ctx context.Context, idToken string) (*auth.Token, error)
}

// NewAuthService creates an AuthService with the given Firebase auth client.
func NewAuthService(client AuthClient) *AuthService {
	return &AuthService{client: client}
}

// VerifyToken validates a Firebase ID token and returns the user ID (UID).
func (s *AuthService) VerifyToken(ctx context.Context, idToken string) (string, error) {
	if idToken == "" {
		return "", fmt.Errorf("service.VerifyToken: token is empty")
	}

	token, err := s.client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return "", fmt.Errorf("service.VerifyToken: %w", err)
	}

	return token.UID, nil
}
