/**
 * Sarah — EPIC-028 Phase 3, Task 1 + Phase 4, Task 9: Greeting system tests
 */

import { buildGreeting } from '../greeting'

// Mock fetch globally so insight fetches return empty (no Go backend in tests)
global.fetch = jest.fn().mockResolvedValue({
  ok: false,
}) as jest.Mock

// Helper: mock Date.getHours() to return a specific hour
function withHour(hour: number, fn: () => void) {
  const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(hour)
  try {
    fn()
  } finally {
    spy.mockRestore()
  }
}

describe('buildGreeting — time-of-day', () => {
  it('generates morning greeting for hour < 12', async () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(8)
    const result = await buildGreeting({})
    expect(result.toLowerCase()).toMatch(/morning/)
    spy.mockRestore()
  })

  it('generates afternoon greeting for hour 12-16', async () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14)
    const result = await buildGreeting({})
    expect(result.toLowerCase()).toMatch(/afternoon/)
    spy.mockRestore()
  })

  it('generates evening greeting for hour 17-20', async () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(19)
    const result = await buildGreeting({})
    expect(result.toLowerCase()).toMatch(/evening/)
    spy.mockRestore()
  })

  it('generates late night greeting for hour >= 21', async () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(23)
    const result = await buildGreeting({})
    expect(result.toLowerCase()).not.toMatch(/morning|afternoon/)
    spy.mockRestore()
  })
})

describe('buildGreeting — user name', () => {
  it('includes user name when available', async () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9)
    const result = await buildGreeting({ userName: 'David' })
    expect(result).toContain('David')
    spy.mockRestore()
  })

  it('omits name placeholder when no user name', async () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9)
    const result = await buildGreeting({})
    expect(result).not.toContain('{name}')
    expect(result).not.toMatch(/,\s*\./)
    spy.mockRestore()
  })
})

describe('buildGreeting — format constraints', () => {
  it('greeting is <= 2 sentences without insight', async () => {
    for (let hour = 0; hour < 24; hour++) {
      const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(hour)
      const result = await buildGreeting({ userName: 'Test' })
      const sentences = result.match(/[.!?]+/g) || []
      expect(sentences.length).toBeLessThanOrEqual(2)
      spy.mockRestore()
    }
  })

  it('greeting does not include markdown or citation numbers', async () => {
    for (let hour = 0; hour < 24; hour++) {
      const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(hour)
      const result = await buildGreeting({})
      expect(result).not.toMatch(/\[\d+\]/)
      expect(result).not.toMatch(/\*\*/)
      expect(result).not.toMatch(/^#{1,6}\s/)
      spy.mockRestore()
    }
  })
})

describe('buildGreeting — contextual greetings', () => {
  it('uses contextual pool when recentTopics provided', async () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9)
    const result = await buildGreeting({
      userName: 'David',
      recentTopics: ['contract review'],
    })
    expect(result.toLowerCase()).toMatch(/vault|document|catch|update|pick|session|ready/)
    spy.mockRestore()
  })

  it('uses base pool when no recentTopics', async () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9)
    const result = await buildGreeting({})
    expect(result.length).toBeGreaterThan(0)
    spy.mockRestore()
  })
})

describe('buildGreeting — insight injection (Phase 4)', () => {
  it('greeting without insights is standard (no filler)', async () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10)
    const result = await buildGreeting({})
    expect(result.length).toBeGreaterThan(10)
    expect(result.toLowerCase()).not.toMatch(/no insight|nothing to report/)
    spy.mockRestore()
  })

  it('greeting + insight stays within TTS budget', async () => {
    // Mock fetch to return a single insight
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: '1', title: 'Contract expires in 3 days', summary: 'Review needed', insightType: 'expiring' }],
      }),
    })

    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9)
    const result = await buildGreeting({ userName: 'David', userId: 'user-123' })
    expect(result.length).toBeLessThan(250)
    expect(result.toLowerCase()).toMatch(/expires|noticed|contract/)
    spy.mockRestore()
  })

  it('greeting + standard content stays under 200 chars without insight', async () => {
    const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(15)
    const result = await buildGreeting({ userName: 'David', recentTopics: ['contract'] })
    expect(result.length).toBeLessThan(200)
    spy.mockRestore()
  })
})
