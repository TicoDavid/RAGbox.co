package worker

import (
	"context"
	"encoding/json"
	"fmt"

	"cloud.google.com/go/pubsub"
)

// Publisher wraps a Pub/Sub topic for publishing messages.
type Publisher struct {
	topic *pubsub.Topic
}

// NewPublisher creates a publisher for the given topic.
func NewPublisher(client *pubsub.Client, topicID string) *Publisher {
	return &Publisher{topic: client.Topic(topicID)}
}

// Publish serializes data as JSON and publishes to the topic.
func (p *Publisher) Publish(ctx context.Context, data interface{}) error {
	bytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("worker.Publish: marshal: %w", err)
	}
	result := p.topic.Publish(ctx, &pubsub.Message{Data: bytes})
	_, err = result.Get(ctx)
	if err != nil {
		return fmt.Errorf("worker.Publish: %w", err)
	}
	return nil
}

// Close flushes the topic's publish buffer.
func (p *Publisher) Close() {
	p.topic.Stop()
}
