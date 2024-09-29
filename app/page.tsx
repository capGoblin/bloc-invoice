"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ethers } from "ethers";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Add this interface near the top of your file, after the imports
interface InvoiceMetadata {
  transactionHash: string;
  customer: string;
  amount: string;
}

const GreenTickIcon = () => (
  <svg
    className="w-6 h-6 text-green-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const RedCrossIcon = () => (
  <svg
    className="w-6 h-6 text-red-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

export default function Home() {
  // State for Generate Invoice form
  const [network, setNetwork] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [transactionDetails, setTransactionDetails] = useState({
    amount: "",
    customer: "",
  });

  // State for Verify Invoice form
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    transactionHash?: string;
    customer?: string;
    amount?: string;
    isValid?: boolean;
    details?: string;
  } | null>(null);

  const networks = {
    sepolia: {
      chainId: "0xaa36a7",
      chainName: "Sepolia",
      rpcUrls: ["https://rpc.sepolia.org"],
    },
  };
  useEffect(() => {
    if (transactionHash && network) {
      fetchTransactionDetails();
    }
  }, [transactionHash]);

  const fetchTransactionDetails = async () => {
    const provider = new ethers.JsonRpcProvider(
      networks[network as keyof typeof networks].rpcUrls[0]
    );

    try {
      const tx = await provider.getTransaction(transactionHash);
      if (tx) {
        setTransactionDetails({
          amount: ethers.formatEther(tx.value),
          customer: tx.from,
        });
      }
    } catch (error) {
      console.error("Error fetching transaction details:", error);
    }
  };

  const generatePDF = async (formData: any, transactionDetails: any) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    const padding = 50;

    const drawText = (text: string, y: number) => {
      page.drawText(text, {
        x: padding,
        y: height - padding - y,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
      });
    };

    drawText("Invoice", 20);
    drawText(`Business Name: ${formData.businessName}`, 40);
    drawText(`Transaction Hash: ${formData.transactionHash}`, 60);
    drawText(`Invoice Date: ${formData.invoiceDate}`, 80);
    drawText(`Customer: ${transactionDetails.customer}`, 100);
    drawText(`Product Name: ${formData.productName}`, 120);
    drawText(`Category: ${formData.category}`, 140);
    drawText(`Quantity: ${formData.quantity}`, 160);
    drawText(`Amount: ${transactionDetails.amount} ETH`, 180);
    drawText(`Network: ${formData.network}`, 200);

    // Create JSON data to store in the PDF metadata
    const jsonData: InvoiceMetadata = {
      transactionHash: formData.transactionHash,
      customer: transactionDetails.customer,
      amount: transactionDetails.amount,
    };

    // Set the PDF subject to the JSON data
    pdfDoc.setSubject(JSON.stringify(jsonData));

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "invoice.pdf";
    link.click();
  };

  const parsePDF = async (file: File): Promise<InvoiceMetadata | undefined> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // Try to get the data from the PDF subject
    const subject = pdfDoc.getSubject();
    if (subject) {
      try {
        const jsonData: InvoiceMetadata = JSON.parse(subject);
        return jsonData;
      } catch (error) {
        console.error("Error parsing JSON from PDF subject:", error);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = {
      businessName,
      transactionHash,
      invoiceDate,
      productName,
      category,
      quantity,
      network,
    };
    generatePDF(formData, transactionDetails);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setInvoiceFile(e.target.files[0]);
    }
  };

  const handleVerify = async () => {
    if (!invoiceFile) {
      alert("Please upload an invoice file first.");
      return;
    }
    try {
      const extractedData = await parsePDF(invoiceFile);
      console.log(extractedData);

      if (!extractedData) {
        throw new Error("Failed to extract data from the PDF");
      }

      // Fetch the transaction details from the blockchain
      const provider = new ethers.JsonRpcProvider(
        networks[network as keyof typeof networks].rpcUrls[0]
      );

      const tx = await provider.getTransaction(extractedData.transactionHash);

      if (tx) {
        const blockchainAmount = ethers.formatEther(tx.value);
        const blockchainCustomer = tx.from;

        // Compare extracted data with blockchain data
        const amountMatch = extractedData.amount === blockchainAmount;
        const customerMatch =
          extractedData.customer.toLowerCase() ===
          blockchainCustomer.toLowerCase();

        setVerificationResult({
          transactionHash: extractedData.transactionHash,
          customer: extractedData.customer,
          amount: `${extractedData.amount} ETH`,
          isValid: amountMatch && customerMatch,
          details: `Amount match: ${amountMatch}, Customer match: ${customerMatch}`,
        });
      } else {
        setVerificationResult({
          transactionHash: extractedData.transactionHash,
          customer: extractedData.customer,
          amount: `${extractedData.amount} ETH`,
          isValid: false,
          details: "Transaction not found on the blockchain",
        });
      }
    } catch (error) {
      console.error(
        "Error parsing invoice file or fetching transaction:",
        error
      );
      alert(
        "Failed to verify the invoice. Please make sure it's a valid PDF file and the transaction exists on the blockchain."
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Generate an Invoice for your Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="generate">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="generate">Generate Invoice</TabsTrigger>
              <TabsTrigger value="verify">Verify Invoice</TabsTrigger>
            </TabsList>
            <TabsContent value="generate">
              <form className="space-y-4 mt-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="network">Network</Label>
                  <Select onValueChange={(value) => setNetwork(value)}>
                    <SelectTrigger id="network">
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sepolia">Sepolia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    placeholder="Enter business name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transactionHash">Transaction Hash</Label>
                  <Input
                    id="transactionHash"
                    placeholder="Enter transaction hash"
                    value={transactionHash}
                    onChange={(e) => setTransactionHash(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productName">Product Name</Label>
                  <Input
                    id="productName"
                    placeholder="Enter your product/service name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="Enter category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    placeholder="Enter quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                {transactionDetails.amount && transactionDetails.customer && (
                  <div className="space-y-2 border p-4 rounded-md bg-gray-50">
                    <h3 className="font-semibold">Transaction Details</h3>
                    <p>Amount: {transactionDetails.amount} ETH</p>
                    <p>Customer Address: {transactionDetails.customer}</p>
                  </div>
                )}
                <Button type="submit" className="w-full">
                  Generate Invoice
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="verify">
              <form className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceFile">Upload Your Invoice</Label>
                  <Input
                    id="invoiceFile"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                  />
                </div>
                {verificationResult && (
                  <div className="flex justify-center items-center mb-4">
                    {verificationResult.isValid ? (
                      <GreenTickIcon />
                    ) : (
                      <RedCrossIcon />
                    )}
                  </div>
                )}
                <Button type="button" className="w-full" onClick={handleVerify}>
                  Verify Invoice
                </Button>
              </form>
              {verificationResult && (
                <div className="mt-4 p-4 border rounded-md bg-gray-50">
                  <h3 className="font-semibold mb-2">Verification Result</h3>
                  <p>
                    <strong>Transaction Hash:</strong>{" "}
                    {verificationResult.transactionHash}
                  </p>
                  <p>
                    <strong>Customer:</strong> {verificationResult.customer}
                  </p>
                  <p>
                    <strong>Amount:</strong> {verificationResult.amount}
                  </p>
                  <p>
                    <strong>Valid:</strong>{" "}
                    {verificationResult.isValid ? "Yes" : "No"}
                  </p>
                  <p>
                    <strong>Details:</strong> {verificationResult.details}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
