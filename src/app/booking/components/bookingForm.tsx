'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import TimeSlots from './timeSlots';  // Import TimeSlots component

const SERVICE_PRICES = {
  haircut: 25,
  haircoloring: 60,
  hairwashing: 15,
  beardtrim: 20,
  scalpmassage: 30,
} as const;

type ServiceType = keyof typeof SERVICE_PRICES;

interface BookingFormProps {
  date: Date | null;
  time: string | null;
  onBooking: (date: Date, time: string) => void;
  bookedTimes: string[]; // Passed from parent component
  onTimeBooked: (time: string) => void; // Callback to handle time booking
}

const BookingForm: React.FC<BookingFormProps> = ({ date, time, onBooking, bookedTimes, onTimeBooked }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState<ServiceType>('haircut');
  const [paymentOption, setPaymentOption] = useState<'now' | 'later'>('now');
  const [price, setPrice] = useState<number>(SERVICE_PRICES.haircut);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    setPrice(SERVICE_PRICES[service]);
  }, [service]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !date || !time) {
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    let paymentSucceeded = false;

    if (paymentOption === 'now') {
      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        setPaymentError('Card element not found');
        setIsProcessing(false);
        return;
      }

      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: price * 100 })
        });

        if (!response.ok) {
          throw new Error('Failed to create payment intent');
        }

        const { clientSecret } = await response.json();

        const result = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElement }
        });

        if (result.error) {
          setPaymentError(result.error.message || 'Payment failed');
        } else if (result.paymentIntent.status === 'succeeded') {
          paymentSucceeded = true;
        }
      } catch (error) {
        setPaymentError('An error occurred during payment processing');
      }
    } else {
      paymentSucceeded = true;
    }

    if (paymentSucceeded) {
      try {
        const response = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: format(date, 'yyyy-MM-dd'),
            time,
            name,
            phone,
            email,
            service,
            hasPaid: paymentOption === 'now',
          }),
        });

        if (response.ok) {
          setBookingSuccess(true);
          onTimeBooked(time);  // Add the booked time to the blocked timeslots
          onBooking(date!, time); // Confirm booking
          resetForm();
        } else {
          const { error } = await response.json();
          setPaymentError(error || 'An error occurred during booking');
        }
      } catch (error) {
        setPaymentError('An error occurred during booking');
      }
    }

    setIsProcessing(false);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setService('haircut');
    setPaymentOption('now');
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Your appointment</h2>
      <form onSubmit={handleSubmit}>
        <p className="mb-2">
          {date ? format(date, 'd MMMM yyyy') : 'No date selected'}
          {time && ` at ${time}`}
        </p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Service</label>
          <select
            value={service}
            onChange={(e) => setService(e.target.value as ServiceType)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            required
          >
            <option value="haircut">Hair cut</option>
            <option value="haircoloring">Hair coloring</option>
            <option value="hairwashing">Hair washing</option>
            <option value="beardtrim">Beard trim</option>
            <option value="scalpmassage">Scalp massage</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Payment Option</label>
          <select
            value={paymentOption}
            onChange={(e) => setPaymentOption(e.target.value as 'now' | 'later')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            required
          >
            <option value="now">Pay Now</option>
            <option value="later">Pay on Service Day</option>
          </select>
        </div>
        
        {paymentOption === 'now' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Card Details</label>
            <CardElement className="mt-1 p-2 border rounded" />
          </div>
        )}
        
        <p className="text-xl font-bold mb-4">${price.toFixed(2)}</p>
        
        <button 
          type="submit" 
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Book Appointment'}
        </button>
      </form>
      
      {paymentError && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
          {paymentError}
        </div>
      )}
      
      {bookingSuccess && (
        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
          Your appointment has been booked successfully!
        </div>
      )}
    </div>
  );
};

export default BookingForm;