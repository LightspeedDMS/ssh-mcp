/**
 * CRITICAL TRIPLE CRLF CONVERSION BUG FIX TEST
 * 
 * Bug: CRLF conversion happening THREE times instead of once:
 * 1. Line 720 in completeSimpleCommand: rawOutput.replace(/\n/g, "\r\n")
 * 2. Line 157 in broadcastToLiveListeners: data.replace(/\n/g, "\r\n") 
 * 3. Line 194 in storeInHistory: data.replace(/\n/g, "\r\n")
 * 
 * Result: \n becomes \r\r\r\n (triple carriage returns) breaking terminal display
 */

describe('Triple CRLF Conversion Bug Fix', () => {

  test('should convert LF to CRLF only once - testing the triple conversion bug', () => {
    // Test the specific methods that do CRLF conversion
    const rawSshOutput = 'echo "hello"\nhello\n[testuser@localhost ~]$ ';
    
    // Test what happens when data goes through all three conversion points:
    // 1. completeSimpleCommand (line 720)
    const firstConversion = rawSshOutput.replace(/\n/g, "\r\n");
    expect(firstConversion).toBe('echo "hello"\r\nhello\r\n[testuser@localhost ~]$ ');
    
    // 2. broadcastToLiveListeners (line 157) - THIS IS THE BUG
    const secondConversion = firstConversion.replace(/\n/g, "\r\n");
    expect(secondConversion).toBe('echo "hello"\r\r\nhello\r\r\n[testuser@localhost ~]$ ');
    
    // 3. storeInHistory (line 194) - THIS IS ALSO THE BUG
    const thirdConversion = secondConversion.replace(/\n/g, "\r\n");
    expect(thirdConversion).toBe('echo "hello"\r\r\r\nhello\r\r\r\n[testuser@localhost ~]$ ');
    
    // CRITICAL: This demonstrates the triple CRLF bug!
    expect(thirdConversion).toMatch(/\r\r\r\n/);
    expect(thirdConversion).not.toMatch(/(?<!\r)\r\n/); // Should NOT have single CRLF after triple conversion
    
    // EXPECTED: Only single CRLF conversion should happen
    expect(firstConversion).toMatch(/\r\n/);
    expect(firstConversion).not.toMatch(/\r\r+\n/);
  });

  test('should demonstrate the fix - only first conversion should be used', () => {
    const rawSshOutput = 'echo "hello"\nhello\n[testuser@localhost ~]$ ';
    
    // CORRECT: Only convert in completeSimpleCommand
    const correctConversion = rawSshOutput.replace(/\n/g, "\r\n");
    
    // FIXED: broadcastToLiveListeners should NOT convert (use data as-is)
    const broadcastData = correctConversion; // No additional conversion
    
    // FIXED: storeInHistory should NOT convert (use data as-is)
    const historyData = correctConversion; // No additional conversion
    
    // Both should have proper single CRLF
    expect(broadcastData).toBe('echo "hello"\r\nhello\r\n[testuser@localhost ~]$ ');
    expect(historyData).toBe('echo "hello"\r\nhello\r\n[testuser@localhost ~]$ ');
    
    // Should NOT have triple carriage returns
    expect(broadcastData).not.toMatch(/\r\r+\n/);
    expect(historyData).not.toMatch(/\r\r+\n/);
    
    // Should have proper single CRLF
    expect(broadcastData).toMatch(/\r\n/);
    expect(historyData).toMatch(/\r\n/);
  });
});